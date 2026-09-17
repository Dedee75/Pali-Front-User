"use client";

import {
  useEffect,
  useState,
} from "react";
import type {
  ChangeEvent,
  FormEvent,
} from "react";
import { useRouter } from "next/navigation";

import { showMessage } from "../../lib/dialog";
import styles from "./register.module.css";

const API_URL = (
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:3000"
).replace(/\/$/, "");

const MAX_IMAGE_SIZE =
  6 * 1024 * 1024;

type FormState = {
  name: string;
  dobDay: string;
  dobMonth: string;
  dobYear: string;
  phone: string;
  occupation: string;
  township: string;
  region: string;
  file: File | null;
  previewUrl: string;
};

type FormErrors =
  Partial<
    Record<
      | "name"
      | "dob"
      | "phone"
      | "occupation"
      | "address"
      | "file"
      | "submit",
      string
    >
  >;

const initialForm: FormState = {
  name: "",
  dobDay: "",
  dobMonth: "",
  dobYear: "",
  phone: "",
  occupation: "",
  township: "",
  region: "",
  file: null,
  previewUrl: "",
};

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

  return "Registration failed.";
}

export default function RegisterPage() {
  const router =
    useRouter();

  const [
    form,
    setForm,
  ] =
    useState<FormState>(
      initialForm,
    );

  const [
    errors,
    setErrors,
  ] =
    useState<FormErrors>({});

  const [
    submitting,
    setSubmitting,
  ] =
    useState(false);

  useEffect(() => {
    return () => {
      if (
        form.previewUrl
      ) {
        URL.revokeObjectURL(
          form.previewUrl,
        );
      }
    };
  }, [form.previewUrl]);

  const handleChange = (
    event:
      ChangeEvent<HTMLInputElement>,
  ) => {
    const {
      name,
      value,
    } =
      event.target;

    const numericFields = [
      "dobDay",
      "dobMonth",
      "dobYear",
      "phone",
    ];

    const nextValue =
      numericFields.includes(
        name,
      )
        ? value.replace(
            /\D/g,
            "",
          )
        : value;

    setForm(
      (
        current,
      ) => ({
        ...current,
        [name]:
          nextValue,
      }),
    );

    setErrors(
      (
        current,
      ) => ({
        ...current,
        [name]:
          undefined,

        dob:
          name.startsWith(
            "dob",
          )
            ? undefined
            : current.dob,

        address:
          name ===
            "township" ||
          name ===
            "region"
            ? undefined
            : current.address,

        submit:
          undefined,
      }),
    );
  };

  const handleFile = (
    event:
      ChangeEvent<HTMLInputElement>,
  ) => {
    const file =
      event.target.files?.[0];

    if (!file) {
      if (
        form.previewUrl
      ) {
        URL.revokeObjectURL(
          form.previewUrl,
        );
      }

      setForm(
        (
          current,
        ) => ({
          ...current,
          file: null,
          previewUrl: "",
        }),
      );

      return;
    }

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (
      !allowedTypes.includes(
        file.type,
      )
    ) {
      setErrors(
        (
          current,
        ) => ({
          ...current,
          file:
            "Only JPG, PNG or WebP images are allowed.",
        }),
      );

      event.target.value =
        "";

      return;
    }

    if (
      file.size >
      MAX_IMAGE_SIZE
    ) {
      setErrors(
        (
          current,
        ) => ({
          ...current,
          file:
            "Photo must be 6 MB or smaller.",
        }),
      );

      event.target.value =
        "";

      return;
    }

    if (
      form.previewUrl
    ) {
      URL.revokeObjectURL(
        form.previewUrl,
      );
    }

    const previewUrl =
      URL.createObjectURL(
        file,
      );

    setForm(
      (
        current,
      ) => ({
        ...current,
        file,
        previewUrl,
      }),
    );

    setErrors(
      (
        current,
      ) => ({
        ...current,
        file:
          undefined,
        submit:
          undefined,
      }),
    );
  };

  const validate =
    (): boolean => {
      const nextErrors:
        FormErrors = {};

      if (
        !form.name.trim()
      ) {
        nextErrors.name =
          "Name is required.";
      } else if (
        !/^[A-Za-z][A-Za-z .'-]*$/.test(
          form.name.trim(),
        )
      ) {
        nextErrors.name =
          "Please enter the name in English.";
      }

      const day =
        Number(
          form.dobDay,
        );

      const month =
        Number(
          form.dobMonth,
        );

      const year =
        Number(
          form.dobYear,
        );

      const date =
        new Date(
          Date.UTC(
            year,
            month - 1,
            day,
          ),
        );

      const validDate =
        Boolean(
          form.dobDay &&
            form.dobMonth &&
            form.dobYear,
        ) &&
        date.getUTCFullYear() ===
          year &&
        date.getUTCMonth() ===
          month - 1 &&
        date.getUTCDate() ===
          day;

      if (!validDate) {
        nextErrors.dob =
          "Please enter a valid date of birth.";
      } else {
        const today =
          new Date();

        let age =
          today.getUTCFullYear() -
          year;

        const monthDifference =
          today.getUTCMonth() -
          (month - 1);

        if (
          monthDifference < 0 ||
          (
            monthDifference ===
              0 &&
            today.getUTCDate() <
              day
          )
        ) {
          age -= 1;
        }

        if (
          age < 5 ||
          age > 100
        ) {
          nextErrors.dob =
            "Student age must be between 5 and 100.";
        }
      }

      if (!form.phone) {
        nextErrors.phone =
          "Phone number is required.";
      } else if (
        !/^09\d{7,9}$/.test(
          form.phone,
        )
      ) {
        nextErrors.phone =
          "Phone must start with 09 and contain 9 to 11 digits.";
      }

      if (
        !form.occupation.trim()
      ) {
        nextErrors.occupation =
          "Occupation is required.";
      }

      if (
        !form.township.trim() ||
        !form.region.trim()
      ) {
        nextErrors.address =
          "Complete address is required.";
      }

      if (!form.file) {
        nextErrors.file =
          "Please choose a photo.";
      } else if (
        form.file.size >
        MAX_IMAGE_SIZE
      ) {
        nextErrors.file =
          "Photo must be 6 MB or smaller.";
      }

      setErrors(
        nextErrors,
      );

      return (
        Object.keys(
          nextErrors,
        ).length === 0
      );
    };

  const handleSubmit =
    async (
      event:
        FormEvent<HTMLFormElement>,
    ) => {
      event.preventDefault();

      if (
        submitting ||
        !validate()
      ) {
        return;
      }

      if (!form.file) {
        setErrors({
          file:
            "Please choose a photo.",
        });

        return;
      }

      setSubmitting(
        true,
      );

      setErrors({});

      try {
        const dateOfBirth =
          `${form.dobYear.padStart(
            4,
            "0",
          )}-${form.dobMonth.padStart(
            2,
            "0",
          )}-${form.dobDay.padStart(
            2,
            "0",
          )}`;

        /*
         * IMPORTANT:
         * Send the actual File through FormData.
         * Do NOT convert the image to Base64.
         */
        const requestBody =
          new FormData();

        requestBody.append(
          "name",
          form.name.trim(),
        );

        requestBody.append(
          "dateOfBirth",
          dateOfBirth,
        );

        requestBody.append(
          "phone",
          form.phone,
        );

        requestBody.append(
          "occupation",
          form.occupation.trim(),
        );

        requestBody.append(
          "township",
          form.township.trim(),
        );

        requestBody.append(
          "region",
          form.region.trim(),
        );

        requestBody.append(
          "image",
          form.file,
          form.file.name,
        );

        const response =
          await fetch(
            `${API_URL}/student-auth/register`,
            {
              method:
                "POST",

              /*
               * Do NOT manually set:
               * Content-Type: multipart/form-data
               *
               * The browser adds the correct boundary.
               */
              body:
                requestBody,
            },
          );

        const result =
          await response
            .json()
            .catch(
              () => null,
            );

        if (!response.ok) {
          if (
            response.status ===
            413
          ) {
            throw new Error(
              "Photo is too large. Maximum allowed size is 6 MB.",
            );
          }

          throw new Error(
            getErrorMessage(
              result,
            ),
          );
        }

        const studentCode =
          result?.student
            ?.studentCode;

        if (
          typeof studentCode !==
          "string"
        ) {
          throw new Error(
            "Student ID was not returned by the server.",
          );
        }

        localStorage.setItem(
          "registeredStudentCode",
          studentCode,
        );

        await showMessage(
          `Register Success\nYour Student ID is ${studentCode}\nPlease keep this ID for login.`,
        );

        router.replace(
          "/",
        );
      } catch (error) {
        setErrors({
          submit:
            error instanceof Error
              ? error.message
              : "Registration failed.",
        });
      } finally {
        setSubmitting(
          false,
        );
      }
    };

  return (
    <div
      className={
        styles.container
      }
    >
      <form
        className={
          styles.form
        }
        onSubmit={
          handleSubmit
        }
        noValidate
      >
        <h1
          className={
            styles.title
          }
        >
          ကျောင်းသားမှတ်ပုံတင်ခြင်း
        </h1>

        {errors.submit && (
          <div
            style={{
              padding:
                "10px 12px",
              marginBottom:
                "14px",
              borderRadius:
                "7px",
              color:
                "#b91c1c",
              background:
                "#fef2f2",
            }}
          >
            {errors.submit}
          </div>
        )}

        <label
          className={
            styles.label
          }
        >
          (၁) ကျောင်းသားအမည်
          (English လိုဖြည့်သွင်းပါ)
        </label>

        <input
          type="text"
          name="name"
          placeholder="Enter name in English"
          value={
            form.name
          }
          onChange={
            handleChange
          }
          className={
            styles.input
          }
          maxLength={
            100
          }
          autoComplete="name"
        />

        <small
          className={
            styles.errorText
          }
        >
          {errors.name}
        </small>

        <label
          className={
            styles.label
          }
        >
          (၂) မွေးသက္ကရာဇ်
        </label>

        <div
          className={
            styles.dobGroup
          }
        >
          <input
            type="text"
            name="dobDay"
            placeholder="နေ့"
            value={
              form.dobDay
            }
            onChange={
              handleChange
            }
            className={
              styles.input
            }
            maxLength={2}
            inputMode="numeric"
          />

          <input
            type="text"
            name="dobMonth"
            placeholder="လ"
            value={
              form.dobMonth
            }
            onChange={
              handleChange
            }
            className={
              styles.input
            }
            maxLength={2}
            inputMode="numeric"
          />

          <input
            type="text"
            name="dobYear"
            placeholder="ခုနှစ်"
            value={
              form.dobYear
            }
            onChange={
              handleChange
            }
            className={
              styles.input
            }
            maxLength={4}
            inputMode="numeric"
          />
        </div>

        <small
          className={
            styles.errorText
          }
        >
          {errors.dob}
        </small>

        <label
          className={
            styles.label
          }
        >
          (၃) ဖုန်းနံပါတ်
          (၀ မှစ၍ရိုက်ပါ)
        </label>

        <input
          type="tel"
          name="phone"
          maxLength={11}
          placeholder="09xxxxxxxxx"
          value={
            form.phone
          }
          onChange={
            handleChange
          }
          className={
            styles.input
          }
          inputMode="numeric"
          autoComplete="tel"
        />

        <small
          className={
            styles.errorText
          }
        >
          {errors.phone}
        </small>

        <label
          className={
            styles.label
          }
        >
          (၄) အလုပ်အကိုင်
        </label>

        <input
          type="text"
          name="occupation"
          placeholder="ဥပမာ - ကျောင်းသား / ဝန်ထမ်း"
          value={
            form.occupation
          }
          onChange={
            handleChange
          }
          className={
            styles.input
          }
          maxLength={
            100
          }
        />

        <small
          className={
            styles.errorText
          }
        >
          {errors.occupation}
        </small>

        <label
          className={
            styles.label
          }
        >
          (၅) နေရပ်လိပ်စာ
        </label>

        <div
          className={
            styles.addressGroup
          }
        >
          <input
            type="text"
            name="township"
            placeholder="ကျေးရွာ / မြို့နယ်"
            value={
              form.township
            }
            onChange={
              handleChange
            }
            className={
              styles.input
            }
            maxLength={
              150
            }
          />

          <input
            type="text"
            name="region"
            placeholder="ပြည်နယ် / တိုင်း"
            value={
              form.region
            }
            onChange={
              handleChange
            }
            className={
              styles.input
            }
            maxLength={
              150
            }
          />
        </div>

        <small
          className={
            styles.errorText
          }
        >
          {errors.address}
        </small>

        <label
          className={
            styles.label
          }
        >
          (၆) ဓာတ်ပုံထည့်ရန်
          (Maximum 6 MB)
        </label>

        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={
            handleFile
          }
          className={`${styles.input} ${styles.fileInput}`}
        />

        {form.previewUrl && (
          <img
            src={
              form.previewUrl
            }
            alt="Student preview"
            style={{
              width:
                "90px",
              height:
                "90px",
              marginTop:
                "10px",
              borderRadius:
                "50%",
              objectFit:
                "cover",
            }}
          />
        )}

        <small
          className={
            styles.errorText
          }
        >
          {errors.file}
        </small>

        <button
          className={
            styles.submit
          }
          type="submit"
          disabled={
            submitting
          }
        >
          {submitting
            ? "မှတ်ပုံတင်နေသည်..."
            : "မှတ်ပုံတင်မည်"}
        </button>

        <button
          type="button"
          className={
            styles.back
          }
          onClick={() =>
            router.back()
          }
          disabled={
            submitting
          }
        >
          နောက်သို့ (Back)
        </button>

        <p
          className={
            styles.footerText
          }
        >
          O-Technique-Myanmar-2026@
        </p>
      </form>
    </div>
  );
}