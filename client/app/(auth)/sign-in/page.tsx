"use client";

import { LoginForm } from '@/components/login-form';
import { Spinner } from '@/components/ui/spinner';
import { authClient } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';
import React, { useEffect } from "react";

const Page = () => {
  const { data, isPending } = authClient.useSession();
  const router = useRouter();

  // ✅ FIX: useEffect me redirect
  useEffect(() => {
    if (data?.session && data?.user) {
      router.push("/");
    }
  }, [data, router]);

  if (isPending) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <Spinner />
      </div>
    );
  }

  // ✅ optional (flicker avoid)
  if (data?.session && data?.user) {
    return null;
  }

  return <LoginForm />;
};

export default Page;