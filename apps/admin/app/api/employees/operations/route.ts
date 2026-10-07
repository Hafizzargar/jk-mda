import { authorizeEmployeeRequest, isEmployeeAuthorization } from '@/lib/employee-server';

type EmployeeOperation =
  | 'request-invite'
  | 'reject-invite-request'
  | 'update-basic'
  | 'change-role'
  | 'request-deletion'
  | 'resolve-deletion';

const operationPermissions: Record<EmployeeOperation, string> = {
  'request-invite': 'employee.invite.request',
  'reject-invite-request': 'employee.invite.review',
  'update-basic': 'employee.basic.update',
  'change-role': 'employee.role.change',
  'request-deletion': 'employee.deletion.request',
  'resolve-deletion': 'employee.deletion.resolve',
};

const operationRpc: Record<EmployeeOperation, string> = {
  'request-invite': 'request_employee_invite',
  'reject-invite-request': 'reject_employee_invite_request',
  'update-basic': 'update_employee_basic',
  'change-role': 'change_employee_role',
  'request-deletion': 'request_employee_deletion',
  'resolve-deletion': 'resolve_employee_deletion',
};

function rpcArguments(operation: EmployeeOperation, body: Record<string, unknown>) {
  switch (operation) {
    case 'request-invite':
      return {
        p_email: body.email,
        p_display_name: body.display_name,
        p_requested_role: body.role_key,
        p_reason: body.reason,
      };
    case 'reject-invite-request':
      return { p_request_id: body.request_id, p_reason: body.reason };
    case 'update-basic':
      return { p_target_id: body.target_id, p_display_name: body.display_name, p_reason: body.reason };
    case 'change-role':
      return { p_target_id: body.target_id, p_role_key: body.role_key, p_reason: body.reason };
    case 'request-deletion':
      return { p_target_id: body.target_id, p_reason: body.reason };
    case 'resolve-deletion':
      return { p_request_id: body.request_id, p_decision: body.decision, p_reason: body.reason };
  }
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const operation = body.operation;
  if (typeof operation !== 'string' || !Object.hasOwn(operationPermissions, operation)) {
    return Response.json({ error: 'Unsupported employee operation.' }, { status: 400 });
  }

  const typedOperation = operation as EmployeeOperation;
  const authorization = await authorizeEmployeeRequest(request, operationPermissions[typedOperation]);
  if (!isEmployeeAuthorization(authorization)) return authorization;

  const { data, error } = await authorization.userClient.rpc(
    operationRpc[typedOperation],
    rpcArguments(typedOperation, body)
  );

  if (error) {
    await authorization.service.from('audit_logs').insert({
      actor_profile_id: authorization.user.id,
      action: `employee.${typedOperation.replaceAll('-', '_')}_denied`,
      target_type: 'employee_operation',
      target_id: typeof body.target_id === 'string' ? body.target_id : null,
      result: 'denied',
      reason: error.message,
      details: { operation: typedOperation, request_id: body.request_id ?? null },
      ...authorization.auditContext,
    });
    // Only deliberate raise-exception messages (SQLSTATE P0001) are safe to show;
    // every other database error is internal and must not reach the browser.
    const clientMessage =
      error.code === 'P0001'
        ? error.message
        : 'The employee operation could not be completed.';
    return Response.json({ error: clientMessage }, { status: 400 });
  }

  return Response.json({ data });
}
