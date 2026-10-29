'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export function NotFoundAutoRedirect({ redirectUrl = '/', delaySeconds = 2 }: { redirectUrl?: string; delaySeconds?: number }) {
  const router = useRouter();
  const [secondsLeft, setSecondsLeft] = useState(delaySeconds);

  useEffect(() => {
    if (secondsLeft <= 0) {
      router.replace(redirectUrl);
      return;
    }

    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          router.replace(redirectUrl);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [secondsLeft, redirectUrl, router]);

  return (
    <div className="mt-4 text-xs font-mono opacity-75">
      Auto-redirecting to homepage in <span className="font-bold underline">{secondsLeft}s</span>...
    </div>
  );
}
