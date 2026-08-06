"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";
import type {
  ChangeEvent,
  FormEvent,
} from "react";
import {
  useRouter,
  useSearchParams,
} from "next/navigation";
import styles from "./homework-create.module.css";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:3000";

const MIN_IMAGES = 3;
const MAX_IMAGES = 20;
const MAX_FILE_SIZE =
  5 * 1024 * 1024;

type StudentProfile = {
  id: number;
  studentCode: string;
  name: string;
  batchId: number;
};

type SelectedImage = {
  id: string;
  file: File;
  previewUrl: string;
};

type HomeworkDetail = {
  id: number;
  title: string;
  description: string;
  dueDate: string;
  status:
    | "NOT_SUBMITTED"
    | "SUBMITTED"
    | "REVIEWED";
  batch: {
    id: number;
    name: string;
  };
};

type UploadRouteState = {
  status:
    | "uploading"
    | "success"
    | "error";
  imageCount: number;
  error?: string;
  startedAt: number;
  finishedAt?: number;
};

function saveUploadRouteState(
  homeworkId: string,
  state: UploadRouteState,
) {
  sessionStorage.setItem(
    `homeworkUpload:${homeworkId}`,
    JSON.stringify(state),
  );

  window.dispatchEvent(
    new CustomEvent(
      "homework-upload-state",
      {
        detail: {
          homeworkId,
        },
      },
    ),
  );
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

  return "Homework upload failed.";
}

export default function HomeworkCreatePage() {
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

  const [images, setImages] =
    useState<SelectedImage[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [
    uploading,
    setUploading,
  ] = useState(false);

  const [error, setError] =
    useState("");

  const remainingSlots =
    useMemo(
      () =>
        MAX_IMAGES -
        images.length,
      [images.length],
    );

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

    const loadHomework =
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

          if (
            result.status ===
            "REVIEWED"
          ) {
            router.replace(
              `/homework-submitted?homeworkId=${homeworkId}`,
            );
            return;
          }

          setHomework(
            result as HomeworkDetail,
          );
        } catch (
          requestError
        ) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Failed to load homework.",
          );
        } finally {
          setLoading(false);
        }
      };

    void loadHomework();
  }, [
    homeworkId,
    router,
  ]);

  useEffect(() => {
    return () => {
      for (
        const image of images
      ) {
        URL.revokeObjectURL(
          image.previewUrl,
        );
      }
    };
  }, [images]);

  const handleFileChange = (
    event:
      ChangeEvent<HTMLInputElement>,
  ) => {
    const selectedFiles =
      Array.from(
        event.target.files ??
          [],
      );

    event.target.value = "";

    if (
      selectedFiles.length === 0
    ) {
      return;
    }

    setError("");

    const acceptedFiles:
      File[] = [];

    for (
      const file of
      selectedFiles
    ) {
      if (
        ![
          "image/jpeg",
          "image/png",
          "image/webp",
        ].includes(
          file.type,
        )
      ) {
        setError(
          "Only JPG, PNG and WebP images are allowed.",
        );
        continue;
      }

      if (
        file.size >
        MAX_FILE_SIZE
      ) {
        setError(
          `${file.name} is larger than 5 MB.`,
        );
        continue;
      }

      const duplicate =
        images.some(
          (image) =>
            image.file.name ===
              file.name &&
            image.file.size ===
              file.size &&
            image.file
              .lastModified ===
              file.lastModified,
        ) ||
        acceptedFiles.some(
          (accepted) =>
            accepted.name ===
              file.name &&
            accepted.size ===
              file.size &&
            accepted.lastModified ===
              file.lastModified,
        );

      if (!duplicate) {
        acceptedFiles.push(
          file,
        );
      }
    }

    const allowedFiles =
      acceptedFiles.slice(
        0,
        remainingSlots,
      );

    if (
      acceptedFiles.length >
      remainingSlots
    ) {
      setError(
        `Only ${remainingSlots} more image(s) can be added. Maximum is ${MAX_IMAGES}.`,
      );
    }

    const newImages =
      allowedFiles.map(
        (file) => ({
          id:
            `${file.name}-${file.size}-${file.lastModified}`,

          file,

          previewUrl:
            URL.createObjectURL(
              file,
            ),
        }),
      );

    setImages(
      (current) => [
        ...current,
        ...newImages,
      ],
    );
  };

  const handleRemoveImage = (
    imageId: string,
  ) => {
    setImages(
      (current) => {
        const removed =
          current.find(
            (image) =>
              image.id ===
              imageId,
          );

        if (removed) {
          URL.revokeObjectURL(
            removed.previewUrl,
          );
        }

        return current.filter(
          (image) =>
            image.id !==
            imageId,
        );
      },
    );

    setError("");
  };

  const handleUpload = async (
    event:
      FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    if (
      uploading ||
      !homeworkId
    ) {
      return;
    }

    if (
      images.length <
      MIN_IMAGES
    ) {
      setError(
        `Please select at least ${MIN_IMAGES} images.`,
      );
      return;
    }

    if (
      images.length >
      MAX_IMAGES
    ) {
      setError(
        `You can upload a maximum of ${MAX_IMAGES} images.`,
      );
      return;
    }

    const token =
      localStorage.getItem(
        "studentAccessToken",
      );

    if (!token) {
      router.replace("/");
      return;
    }

    setUploading(true);
    setError("");

    const startedAt =
      Date.now();

    saveUploadRouteState(
      homeworkId,
      {
        status:
          "uploading",
        imageCount:
          images.length,
        startedAt,
      },
    );

    /*
     * Loading page ကို ချက်ချင်းဖွင့်ပေးပြီး
     * upload request ကို background မှာ
     * ဆက်လုပ်ပါမယ်။
     */
    router.push(
      `/upload-loading?homeworkId=${homeworkId}`,
    );

    try {
      const formData =
        new FormData();

      for (
        const image of images
      ) {
        formData.append(
          "images",
          image.file,
        );
      }

      const response =
        await fetch(
          `${API_URL}/student-homeworks/${homeworkId}/submit`,
          {
            method: "POST",

            headers: {
              Authorization:
                `Bearer ${token.trim()}`,
            },

            body: formData,
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
        sessionStorage.removeItem(
          `homeworkUpload:${homeworkId}`,
        );

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

      saveUploadRouteState(
        homeworkId,
        {
          status:
            "success",
          imageCount:
            images.length,
          startedAt,
          finishedAt:
            Date.now(),
        },
      );
    } catch (
      uploadError
    ) {
      const message =
        uploadError instanceof Error
          ? uploadError.message
          : "Homework upload failed.";

      saveUploadRouteState(
        homeworkId,
        {
          status:
            "error",
          imageCount:
            images.length,
          error: message,
          startedAt,
          finishedAt:
            Date.now(),
        },
      );

      /*
       * Loading route ပြောင်းမသွားခဲ့ရင်
       * မူလ page မှာ error ပြနိုင်ရန်။
       */
      setError(message);
    } finally {
      setUploading(false);
    }
  };

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
            Loading homework...
          </div>
        </div>
      </div>
    );
  }

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
            </span>
          </div>
        </div>

        <div
          className={
            styles.formBox
          }
        >
          <form
            onSubmit={
              handleUpload
            }
          >
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

            <div
              className={
                styles.formGroup
              }
            >
              <label
                className={
                  styles.label
                }
              >
                Homework
              </label>

              <input
                type="text"
                className={
                  styles.readOnlyInput
                }
                value={
                  homework?.title ??
                  ""
                }
                readOnly
              />
            </div>

            <div
              className={
                styles.formGroup
              }
            >
              <label
                className={
                  styles.label
                }
              >
                Student ID
              </label>

              <input
                type="text"
                className={
                  styles.readOnlyInput
                }
                value={
                  student?.studentCode ??
                  ""
                }
                readOnly
              />
            </div>

            <div
              className={
                styles.formGroup
              }
            >
              <label
                className={
                  styles.label
                }
              >
                Homework Images
                ({MIN_IMAGES} -{" "}
                {MAX_IMAGES})
              </label>

              <div
                className={
                  styles.fileInputWrapper
                }
              >
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  onChange={
                    handleFileChange
                  }
                  className={
                    styles.fileInput
                  }
                  disabled={
                    uploading ||
                    images.length >=
                      MAX_IMAGES
                  }
                />
              </div>

              <p
                style={{
                  margin:
                    "8px 0 0",
                  color: "#666",
                  fontSize:
                    "13px",
                }}
              >
                Selected:{" "}
                {images.length} /{" "}
                {MAX_IMAGES}. Each
                image must be 5 MB
                or smaller.
              </p>
            </div>

            {images.length > 0 && (
              <div
                className={
                  styles.previewGrid
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
                        styles.previewWrapper
                      }
                    >
                      <img
                        src={
                          image.previewUrl
                        }
                        alt={`Homework page ${index + 1}`}
                        className={
                          styles.previewImg
                        }
                      />

                      <span
                        style={{
                          position:
                            "absolute",
                          left: "6px",
                          bottom:
                            "6px",
                          minWidth:
                            "24px",
                          padding:
                            "2px 6px",
                          borderRadius:
                            "10px",
                          color:
                            "#fff",
                          background:
                            "rgba(0,0,0,.65)",
                          fontSize:
                            "12px",
                          textAlign:
                            "center",
                        }}
                      >
                        {index + 1}
                      </span>

                      <button
                        type="button"
                        className={
                          styles.deleteBtn
                        }
                        onClick={() =>
                          handleRemoveImage(
                            image.id,
                          )
                        }
                        disabled={
                          uploading
                        }
                        aria-label={`Remove image ${index + 1}`}
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="black"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <line
                            x1="18"
                            y1="6"
                            x2="6"
                            y2="18"
                          />
                          <line
                            x1="6"
                            y1="6"
                            x2="18"
                            y2="18"
                          />
                        </svg>
                      </button>
                    </div>
                  ),
                )}
              </div>
            )}

            <button
              type="submit"
              className={
                styles.btnUpload
              }
              disabled={
                uploading ||
                images.length <
                  MIN_IMAGES
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
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line
                  x1="12"
                  y1="3"
                  x2="12"
                  y2="15"
                />
              </svg>

              {uploading
                ? "Uploading..."
                : `Upload ${images.length} Image(s)`}
            </button>

            <button
              type="button"
              onClick={() =>
                router.back()
              }
              disabled={
                uploading
              }
              style={{
                width: "100%",
                marginTop:
                  "12px",
                padding:
                  "11px",
                border:
                  "1px solid #b8860b",
                borderRadius:
                  "7px",
                color:
                  "#b8860b",
                background:
                  "transparent",
                cursor:
                  uploading
                    ? "not-allowed"
                    : "pointer",
                fontWeight: 600,
              }}
            >
              Back
            </button>
          </form>
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