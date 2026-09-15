"use client";

import {
  Suspense,
  useEffect,
  useState,
} from "react";
import {
  useRouter,
  useSearchParams,
} from "next/navigation";
import styles from "./homework-submitted.module.css";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:3000";

type StudentProfile = {
  id: number;
  studentCode: string;
  name: string;
  batchId: number;
};

type SubmissionImage = {
  id: number;
  image: string;
  marks: number | null;
  remark: string | null;
};

type HomeworkDetail = {
  id: number;
  title: string;
  description: string;
  dueDate: string;
  totalMarks: number | null;
  status:
    | "NOT_SUBMITTED"
    | "SUBMITTED"
    | "REVIEWED";

  batch: {
    id: number;
    name: string;
  };

  submission: {
    id: number;
    status:
      | "PENDING"
      | "SUBMITTED"
      | "REVIEWED";

    submittedAt:
      | string
      | null;

    totalMarks:
      | number
      | null;

    remark:
      | string
      | null;

    images:
      SubmissionImage[];
  } | null;
};

function resolveImageUrl(
  value: string,
): string {
  if (
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("data:") ||
    value.startsWith("blob:")
  ) {
    return value;
  }

  return `${API_URL}${
    value.startsWith("/")
      ? value
      : `/${value}`
  }`;
}

function getErrorMessage(
  result: unknown,
): string {
  if (
    result &&
    typeof result === "object" &&
    "message" in result
  ) {
    const message = (
      result as {
        message?: unknown;
      }
    ).message;

    if (
      Array.isArray(message)
    ) {
      return message.join(", ");
    }

    if (
      typeof message === "string"
    ) {
      return message;
    }
  }

  return "Failed to load submitted homework.";
}

function HomeworkSubmittedContent() {
  const router = useRouter();
  const searchParams =
    useSearchParams();

  const homeworkId =
    searchParams.get(
      "homeworkId",
    );

  const [student, setStudent] =
    useState<StudentProfile | null>(
      null,
    );

  const [
    homework,
    setHomework,
  ] =
    useState<HomeworkDetail | null>(
      null,
    );

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  useEffect(() => {
    const token =
      localStorage.getItem(
        "studentAccessToken",
      );

    const storedStudent =
      localStorage.getItem(
        "student",
      );

    if (
      !token ||
      !storedStudent
    ) {
      router.replace("/");
      return;
    }

    if (
      !homeworkId ||
      !/^\d+$/.test(
        homeworkId,
      )
    ) {
      setError(
        "Invalid homework ID.",
      );
      setLoading(false);
      return;
    }

    try {
      setStudent(
        JSON.parse(
          storedStudent,
        ) as StudentProfile,
      );
    } catch {
      localStorage.removeItem(
        "studentAccessToken",
      );
      localStorage.removeItem(
        "student",
      );
      router.replace("/");
      return;
    }

    const loadSubmission =
      async () => {
        try {
          const response =
            await fetch(
              `${API_URL}/student-homeworks/${homeworkId}`,
              {
                headers: {
                  Accept:
                    "application/json",

                  Authorization:
                    `Bearer ${token.trim()}`,
                },

                cache:
                  "no-store",
              },
            );

          const result =
            await response
              .json()
              .catch(
                () => null,
              );

          if (
            response.status ===
            401
          ) {
            localStorage.removeItem(
              "studentAccessToken",
            );
            localStorage.removeItem(
              "student",
            );
            router.replace("/");
            return;
          }

          if (!response.ok) {
            throw new Error(
              getErrorMessage(
                result,
              ),
            );
          }

          const detail =
            result as HomeworkDetail;

          if (
            !detail.submission ||
            detail.status ===
              "NOT_SUBMITTED"
          ) {
            router.replace(
              `/homework-create?homeworkId=${homeworkId}`,
            );
            return;
          }

          setHomework(
            detail,
          );
        } catch (
          requestError
        ) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Failed to load submitted homework.",
          );
        } finally {
          setLoading(false);
        }
      };

    void loadSubmission();
  }, [
    homeworkId,
    router,
  ]);

  if (loading) {
    return (
      <div
        className={
          styles.container
        }
      >
        <div
          className={
            styles.mobileFrame
          }
        >
          <div
            style={{
              padding: "50px",
              textAlign:
                "center",
            }}
          >
            Loading submitted
            homework...
          </div>
        </div>
      </div>
    );
  }

  const images =
    homework?.submission
      ?.images ?? [];

  const isReviewed =
    homework?.status ===
    "REVIEWED";

  return (
    <div
      className={
        styles.container
      }
    >
      <div
        className={
          styles.mobileFrame
        }
      >
        <div
          className={
            styles.userCard
          }
        >
          <h1
            className={
              styles.greeting
            }
          >
            မင်္ဂလာပါ,{" "}
            {student?.name ??
              "Student"}
          </h1>

          <div
            className={
              styles.batchInfo
            }
          >
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
              <circle
                cx="9"
                cy="7"
                r="4"
              />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>

            <span>
              {homework?.batch
                .name ??
                `Batch ${student?.batchId ?? ""}`}
              {" · "}
              {student?.studentCode ??
                ""}
            </span>
          </div>
        </div>

        <h2
          className={
            styles.sectionTitle
          }
        >
          {homework?.title ??
            "Submitted Homework"}
        </h2>

        {error && (
          <div
            style={{
              padding:
                "10px 12px",
              marginBottom:
                "14px",
              borderRadius:
                "8px",
              color:
                "#b91c1c",
              background:
                "#fef2f2",
            }}
          >
            {error}
          </div>
        )}

        {homework && (
          <div
            style={{
              marginBottom:
                "16px",
              padding:
                "12px 14px",
              border:
                "1px solid #ead8a6",
              borderRadius:
                "10px",
              background:
                "#fffaf0",
              fontSize:
                "14px",
              lineHeight: 1.7,
            }}
          >
            <div>
              <strong>
                Status:
              </strong>{" "}
              {isReviewed
                ? "Reviewed"
                : "Submitted"}
            </div>

            <div>
              <strong>
                Submitted:
              </strong>{" "}
              {homework.submission
                ?.submittedAt
                ? new Date(
                    homework.submission
                      .submittedAt,
                  ).toLocaleString()
                : "-"}
            </div>

            {isReviewed && (
              <>
                <div>
                  <strong>
                    Mark:
                  </strong>{" "}
                  {homework.submission
                    ?.totalMarks ??
                    "-"}
                  {homework.totalMarks !==
                  null
                    ? ` / ${homework.totalMarks}`
                    : ""}
                </div>

                <div>
                  <strong>
                    Teacher Comment:
                  </strong>{" "}
                  {homework.submission
                    ?.remark ??
                    "No comment"}
                </div>
              </>
            )}

            <div>
              <strong>
                Images:
              </strong>{" "}
              {images.length}
            </div>
          </div>
        )}

        <div
          className={
            styles.imageGrid
          }
        >
          {images.map(
            (
              image,
              index,
            ) => (
              <div
                key={
                  image.id
                }
                className={
                  styles.imageWrapper
                }
              >
                <img
                  src={resolveImageUrl(
                    image.image,
                  )}
                  alt={`Submitted homework page ${index + 1}`}
                  className={
                    styles.submittedImg
                  }
                  loading="lazy"
                />

                <span
                  style={{
                    position:
                      "absolute",
                    left: "7px",
                    bottom:
                      "7px",
                    padding:
                      "3px 8px",
                    borderRadius:
                      "12px",
                    color: "#fff",
                    background:
                      "rgba(0,0,0,.65)",
                    fontSize:
                      "12px",
                  }}
                >
                  Page {index + 1}
                </span>
              </div>
            ),
          )}
        </div>

        {images.length === 0 &&
          !error && (
            <div
              style={{
                padding:
                  "32px",
                textAlign:
                  "center",
                color: "#777",
              }}
            >
              No submitted images
              were found.
            </div>
          )}

        <div
          className={
            styles.buttonContainer
          }
        >
          {!isReviewed &&
            homeworkId && (
              <button
                type="button"
                className={
                  styles.btnBack
                }
                onClick={() =>
                  router.push(
                    `/homework-create?homeworkId=${homeworkId}`,
                  )
                }
                style={{
                  marginBottom:
                    "10px",
                }}
              >
                Replace Images
              </button>
            )}

          <button
            type="button"
            className={
              styles.btnBack
            }
            onClick={() =>
              router.push(
                "/homepage",
              )
            }
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line
                x1="19"
                y1="12"
                x2="5"
                y2="12"
              />
              <polyline points="12 19 5 12 12 5" />
            </svg>

            ပြန်ထွက်မည်
            (Back)
          </button>
        </div>

        <div
          className={
            styles.footer
          }
        >
          O-Technique-Myanmar-2026@
        </div>
      </div>
    </div>
  );
}

export default function HomeworkSubmittedPage() {
  return (
    <Suspense
      fallback={
        <div className={styles.container}>
          <div className={styles.mobileFrame}>
            <div style={{ padding: "50px", textAlign: "center" }}>
              Loading submitted homework...
            </div>
          </div>
        </div>
      }
    >
      <HomeworkSubmittedContent />
    </Suspense>
  );
}
