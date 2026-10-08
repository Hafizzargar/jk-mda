export class NextRequest {
  public nextUrl: URL;
  public url: string;
  public headers: Headers;
  public cookies: {
    getAll: () => { name: string; value: string }[];
    set: (name: string, value: string) => void;
  };

  constructor(url: string, init?: { headers?: Record<string, string> }) {
    this.url = url;
    this.nextUrl = new URL(url) as any;
    (this.nextUrl as any).clone = function() {
      const cloned = new URL(this.href) as any;
      cloned.clone = this.clone;
      return cloned;
    };
    this.headers = new Headers(init?.headers);
    this.cookies = {
      getAll: () => [],
      set: () => {},
    };
  }
}

export class NextResponse {
  public status: number;
  public headers: Headers;
  public cookies: {
    set: (name: string, value: string, options?: any) => void;
  };

  constructor(status = 200) {
    this.status = status;
    this.headers = new Headers();
    this.cookies = {
      set: () => {},
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
    const res = new NextResponse(init?.status ?? 200);
    res.headers.set('Content-Type', 'application/json');
    return res;
  }
}
