import { NextResponse } from 'next/server';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body.email !== 'string') {
      return NextResponse.json({ error: 'Valid email address is required' }, { status: 400 });
    }

    const email = body.email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(email) || email.length > 254) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    // In a production setup, this inserts into subscribers table or dispatch to newsletter service.
    // For now, accept and return success confirmation.
    return NextResponse.json({
      success: true,
      message: 'Thank you for subscribing to KJIN daily dispatches.',
    });
  } catch (err) {
    console.error('Newsletter subscription error:', err);
    return NextResponse.json({ error: 'Failed to process subscription' }, { status: 500 });
  }
}
