"use client";

import { useRouter } from "next/navigation";
import styles from "./upload-success.module.css";

export default function UploadSuccessPage() {
  const router = useRouter();

  return (
    <div className={styles.container}>
      <div className={styles.mobileFrame}>
        
        {/* Main Success Content Box */}
        <div className={styles.successBox}>
          
          <div className={styles.iconCircle}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#2e7d32" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
          </div>
          
          <h1 className={styles.title}>အောင်မြင်ပါသည်</h1>
          <p className={styles.subtitle}>
            အိမ်စာ အောင်မြင်စွာ တင်ပြီးပါပြီ။ (Homework successfully submitted)
          </p>

          <button 
            type="button" 
            className={styles.btnHome}
            onClick={() => router.push("/homepage")}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
              <polyline points="9 22 9 12 15 12 15 22"></polyline>
            </svg>
            ပင်မစာမျက်နှာသို့ (Home)
          </button>

        </div>

        {/* Footer */}
        <div className={styles.footer}>
          O-Technique-Myanmar-2026@
        </div>
        
      </div>
    </div>
  );
}