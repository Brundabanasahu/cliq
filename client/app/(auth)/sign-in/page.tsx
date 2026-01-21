"use client";
import { LoginForm } from '@/components/login-form';
import { Spinner } from '@/components/ui/spinner';
import { authClient } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';
import React, { use, useEffect } from "react";

const page = () => {
    const {data,isPending}=authClient.useSession();
  const router=useRouter();

  useEffect(() => {
    if(!isPending && (data?.session || data?.user)) {
      router.push("/sign-in");
  }
  }, [isPending, data, router]);
  
  if(isPending){
    return(
      <div className="flex flex-col items-center justify-center h-screen">
        <Spinner/>
      </div>
    )
  }
    return (
        <>
        <LoginForm/>
        </>
    )
}

export default page