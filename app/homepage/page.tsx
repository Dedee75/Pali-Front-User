"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./homepage.module.css";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

type StudentProfile = {
  id: number;
  studentCode: string;
  name: string;
  batchId: number;
  batch?: {
    id: number;
    name: string;
  } | null;
};

type HomeworkStatus =
  | "NOT_SUBMITTED"
  | "SUBMITTED"
  | "REVIEWED";

type HomeworkSubmission = {
  id: number;
  submittedAt: string | null;
  totalMarks: number | null;
  remark: string | null;
  images: Array<{
    id: number;
    image: string;
    marks: number | null;
    remark: string | null;
  }>;
};

type HomeworkItem = {
  id: number;
  weekLabel: string;
  title: string;
  description: string;
  dueDate: string;
  totalMarks: number | null;
  status: HomeworkStatus;
  batch: {
    id: number;
    name: string;
  };
  submission: HomeworkSubmission | null;
};

function getStoredStudent(): StudentProfile | null {
  const value = localStorage.getItem("student");

  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as StudentProfile;
  } catch {
    return null;
  }
}

function getErrorMessage(value: unknown, fallback: string): string {
  if (value && typeof value === "object" && "message" in value) {
    const message = (value as { message?: unknown }).message;

    if (typeof message === "string") {
      return message;
    }

    if (Array.isArray(message)) {
      return message.join(", ");
    }
  }

  return fallback;
}

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function getStatusText(status: HomeworkStatus): string {
  if (status === "REVIEWED") {
    return "စစ်ဆေးပြီး (Reviewed)";
  }

  if (status === "SUBMITTED") {
    return "တင်ပြီးပါပြီ (Submitted)";
  }

  return "မတင်ရသေး (Not Submitted)";
}

export default function Homepage() {
  const router = useRouter();

  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [homeworks, setHomeworks] = useState<HomeworkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    const clearStudentSession = () => {
      localStorage.removeItem("studentAccessToken");
      localStorage.removeItem("student");
    };

    const loadHomepage = async () => {
      const token = localStorage.getItem("studentAccessToken");

      if (!token) {
        clearStudentSession();
        router.replace("/");
        return;
      }

      const storedStudent = getStoredStudent();

      if (storedStudent) {
        setStudent(storedStudent);
      }

      try {
        const headers = {
          Accept: "application/json",
          Authorization: `Bearer ${token.trim()}`,
        };

        const [profileResponse, homeworkResponse] = await Promise.all([
          fetch(`${API_URL}/student-auth/me`, {
            method: "GET",
            headers,
            cache: "no-store",
            signal: controller.signal,
          }),
          fetch(`${API_URL}/student-homeworks`, {
            method: "GET",
            headers,
            cache: "no-store",
            signal: controller.signal,
          }),
        ]);

        if (profileResponse.status === 401 || homeworkResponse.status === 401) {
          clearStudentSession();
          router.replace("/");
          return;
        }

        const [profileResult, homeworkResult] = await Promise.all([
          profileResponse.json().catch(() => null),
          homeworkResponse.json().catch(() => null),
        ]);

        if (!profileResponse.ok) {
          throw new Error(
            getErrorMessage(profileResult, "Failed to load student profile."),
          );
        }

        if (!homeworkResponse.ok) {
          throw new Error(
            getErrorMessage(homeworkResult, "Failed to load homework list."),
          );
        }

        const profile = profileResult as StudentProfile;
        const homeworkList = Array.isArray(homeworkResult)
          ? (homeworkResult as HomeworkItem[])
          : [];

        setStudent(profile);
        setHomeworks(homeworkList);
        localStorage.setItem("student", JSON.stringify(profile));
      } catch (requestError) {
        if (
          requestError instanceof DOMException &&
          requestError.name === "AbortError"
        ) {
          return;
        }

        setError(
          requestError instanceof Error
            ? requestError.message
            : "Failed to load homepage.",
        );
      } finally {
        setLoading(false);
      }
    };

    void loadHomepage();

    return () => {
      controller.abort();
    };
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem("studentAccessToken");
    localStorage.removeItem("student");
    router.replace("/");
  };

  const openHomework = (homework: HomeworkItem) => {
    if (homework.status === "NOT_SUBMITTED") {
      router.push(`/homework-create?homeworkId=${homework.id}`);
      return;
    }

    router.push(`/homework-submitted?homeworkId=${homework.id}`);
  };

  const batchName =
    student?.batch?.name ??
    homeworks[0]?.batch?.name ??
    `Batch ${String(student?.batchId ?? "").padStart(3, "0")}`;

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.mobileFrame}>
          <div
            style={{
              minHeight: "100vh",
              display: "grid",
              placeItems: "center",
              padding: "24px",
            }}
          >
            Loading...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.mobileFrame}>
        <div className={styles.userCard}>
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: "12px",
            }}
          >
            <div>
              <h1 className={styles.greeting}>
                မင်္ဂလာပါ, {student?.name ?? "Student"}
              </h1>

              <div className={styles.batchInfo}>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#b8860b"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>

                <span>
                  {batchName} · {student?.studentCode ?? ""}
                </span>
              </div>
            </div>

            <button
            type="button"
            className={
              styles.logoutBtn
            }
            onClick={handleLogout}
            title="Logout"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#b8860b"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 21H5a2 2 0 0 0-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line
                x1="21"
                y1="12"
                x2="9"
                y2="12"
              />
            </svg>
          </button>
          </div>
        </div>

        {error && (
          <div
            style={{
              margin: "14px 0",
              padding: "11px 12px",
              borderRadius: "8px",
              background: "#fef2f2",
              color: "#b91c1c",
              fontSize: "14px",
            }}
          >
            {error}
          </div>
        )}

        <h2 className={styles.sectionTitle}>
          Weekly Homework (အိမ်စာများ)
        </h2>

        <div className={styles.homeworkList}>
          {homeworks.length === 0 && !error && (
            <div
              className={styles.card}
              style={{ textAlign: "center", color: "#666" }}
            >
              လက်ရှိအိမ်စာ မရှိသေးပါ။
            </div>
          )}

          {homeworks.map((homework) => {
            const isNotSubmitted = homework.status === "NOT_SUBMITTED";
            const isReviewed = homework.status === "REVIEWED";

            return (
              <div key={homework.id} className={styles.card}>
                <div className={styles.cardHeader}>
                  <span className={styles.weekBadge}>
                    {homework.weekLabel}
                  </span>

                  <span
                    className={
                      isNotSubmitted
                        ? styles.statusNotSubmitted
                        : styles.statusApproved
                    }
                  >
                    {getStatusText(homework.status)}
                  </span>
                </div>

                <h3 className={styles.taskTitle}>{homework.title}</h3>

                <p className={styles.taskDesc}>{homework.description}</p>

                <div className={styles.dueDateBox}>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#666"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>

                  <span>Due: {formatDate(homework.dueDate)}</span>
                </div>

                {isReviewed && homework.submission && (
                  <div
                    style={{
                      margin: "10px 0",
                      padding: "9px 10px",
                      borderRadius: "8px",
                      background: "#f7f7f7",
                      fontSize: "13px",
                      lineHeight: 1.6,
                    }}
                  >
                    <div>
                      Mark: {homework.submission.totalMarks ?? "-"}
                      {homework.totalMarks !== null
                        ? ` / ${homework.totalMarks}`
                        : ""}
                    </div>

                    <div>
                      Comment: {homework.submission.remark ?? "No comment"}
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  className={
                    isNotSubmitted ? styles.btnUpload : styles.btnSubmitted
                  }
                  onClick={() => openHomework(homework)}
                >
                  {isNotSubmitted ? (
                    <>
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                      </svg>

                      တင်ရန် (Upload)
                    </>
                  ) : (
                    <>
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                        <polyline points="22 4 12 14.01 9 11.01" />
                      </svg>

                      {isReviewed
                        ? "စစ်ဆေးပြီး (View)"
                        : "တင်ပြီးပါပြီ (Submitted)"}
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        <div className={styles.footer}>O-Technique-Myanmar-2026@</div>
      </div>
    </div>
  );
}