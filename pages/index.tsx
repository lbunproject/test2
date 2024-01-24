import type { NextPage } from "next";
import { useEffect } from 'react';
import { useRouter } from 'next/router';

const Home: NextPage = () => {
  const router = useRouter();

  useEffect(() => {
    router.replace('/stake'); // Replace the current entry in the history stack
  }, [router]);

  return null; // or a loading indicator
};

export default Home;
