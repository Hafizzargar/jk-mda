export class NextRequest {
  public nextUrl: URL;
  public url: string;
  public headers: Headers;
  public cookies: {
    getAll: () => { name: string; value: string }[];
    set: (name: string, value: string) => void;
  };

  constructor(url: string, init?: { method?: string; headers?: Record<string, string>; body?: any }) {
    this.url = url;
    this.nextUrl = new URL(url) as any;
    (this.nextUrl as any).clone = function() {
      const cloned = new URL(this.href) as any;
      cloned.clone = this.clone;
      return cloned;
    };
    this.headers = new Headers(init?.headers);

    const cookieHeader = this.headers.get('cookie') || '';
    const parsedCookies: { name: string; value: string }[] = cookieHeader
      ? cookieHeader.split(';').map((c) => {
          const [name, ...val] = c.trim().split('=');
          return { name, value: val.join('=') };
        })
      : [];

    this.cookies = {
      getAll: () => parsedCookies,
      set: (name: string, value: string) => {
        parsedCookies.push({ name, value });
      },
    };
  }
}

export class NextResponse {
  public status: number;
  public headers: Headers;
  public cookies: {
    set: (name: string, value: string, options?: any) => void;
    delete: (name: string) => void;
    getAll: () => { name: string; value: string }[];
  };
  private _body: any;

  constructor(status = 200, body?: any) {
    this.status = status;
    this.headers = new Headers();
    this._body = body;

    const cookieList: { name: string; value: string; options?: any }[] = [];

    this.cookies = {
      set: (name: string, value: string, options?: any) => {
        cookieList.push({ name, value, options });
        let headerVal = `${name}=${value}; Path=${options?.path || '/'}`;
        if (options?.maxAge !== undefined) headerVal += `; Max-Age=${options.maxAge}`;
        if (options?.httpOnly) headerVal += '; HttpOnly';
        if (options?.sameSite) headerVal += `; SameSite=${options.sameSite}`;
        this.headers.append('set-cookie', headerVal);
      },
      delete: (name: string) => {
        this.cookies.set(name, '', { maxAge: 0, path: '/' });
      },
      getAll: () => cookieList,
    };
  }

  static next(init?: any) {
    const res = new NextResponse();
    if (init?.request?.headers) {
      // copy headers if needed
    }
    return res;
  }

  static redirect(url: string | URL, status = 302) {
    const res = new NextResponse(status);
    res.headers.set('Location', url.toString());
    return res;
  }
  
  static json(body: any, init?: any) {
    const res = new NextResponse(init?.status ?? 200, body);
    res.headers.set('Content-Type', 'application/json');
    return res;
  }

  async json() {
    return typeof this._body === 'string' ? JSON.parse(this._body) : this._body;
  }
}

export function after(task: () => Promise<void> | void) {
  Promise.resolve().then(() => task()).catch((err) => {
    console.error('[fake-next-server after] task error:', err);
  });
}
