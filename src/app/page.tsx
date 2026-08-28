import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <main className="text-center">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">
          JobEthiopia
        </h1>
        <p className="mt-6 text-lg leading-8 text-gray-600">
          An Ethiopian job and career platform.
        </p>
        <Link
          href="/jobs"
          className="mt-8 inline-block rounded-md bg-gray-900 px-6 py-3 text-sm font-semibold text-white hover:bg-gray-700 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-300"
        >
          Browse Jobs
        </Link>
      </main>
    </div>
  );
}
