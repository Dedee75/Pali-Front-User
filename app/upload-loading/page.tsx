"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import styles from "./upload-loading.module.css";

export default function UploadLoadingPage() {
  const router = useRouter();

  // Automatically redirect to success page after 2.5 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      router.push("/upload-success");
    }, 2500);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className={styles.container}>
      <div className={styles.mobileFrame}>
        <div className={styles.centerContent}>
          {/* Custom Gold Spinner matching the screenshot */}
          <div className={styles.spinner}>
            <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
              <g fill="none" stroke="#b8860b" strokeWidth="8" strokeLinecap="round">
                <line x1="50" y1="15" x2="50" y2="25" opacity="1" />
                <line x1="74.75" y1="25.25" x2="67.68" y2="32.32" opacity="0.8" />
                <line x1="85" y1="50" x2="75" y2="50" opacity="0.6" />
                <line x1="74.75" y1="74.75" x2="67.68" y2="67.68" opacity="0.4" />
                <line x1="50" y1="85" x2="50" y2="75" opacity="0.2" />
                <line x1="25.25" y1="74.75" x2="32.32" y2="67.68" opacity="0.2" />
                <line x1="15" y1="50" x2="25" y2="50" opacity="0.2" />
                <line x1="25.25" y1="25.25" x2="32.32" y2="32.32" opacity="0.5" />
              </g>
            </svg>
          </div>
          <p className={styles.loadingText}>Loading Homework Photo, Please Wait...</p>
        </div>
      </div>
    </div>
  );
}