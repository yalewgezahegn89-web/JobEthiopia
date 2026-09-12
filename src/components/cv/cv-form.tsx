"use client";

import { useActionState, useState } from "react";
import { useI18n } from "@/lib/i18n/client";
import { saveCvAction, type CvActionResult } from "@/app/cv/actions";
import {
  CV_TITLE_MAX,
  CV_SUMMARY_MAX,
  CV_STRING_SHORT_MAX,
  CV_DESCRIPTION_MAX,
  CV_SKILL_NAME_MAX,
  CV_LEVEL_MAX,
  CV_LOCATION_MAX,
  CV_EXPERIENCES_MAX,
  CV_EDUCATIONS_MAX,
  CV_SKILLS_MAX,
  CV_CERTIFICATIONS_MAX,
} from "@/lib/validations/cv";

export type CvFormSection = {
  id: string;
  [key: string]: string;
};

export type CvFormInitial = {
  title: string;
  professionalSummary: string;
  phone: string;
  location: string;
  websiteUrl: string;
  experiences: CvFormSection[];
  educations: CvFormSection[];
  skills: CvFormSection[];
  certifications: CvFormSection[];
};

const INITIAL_STATE: CvActionResult = { ok: false };

const inputClass =
  "mt-1.5 w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

const labelClass = "block text-sm font-medium text-foreground";

function nextKey(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function CvForm({ initial }: { initial: CvFormInitial }) {
  const { t } = useI18n();
  const f = t.cv.form;

  const [state, formAction, isPending] = useActionState<CvActionResult, FormData>(
    saveCvAction,
    INITIAL_STATE,
  );

  const [header, setHeader] = useState({
    title: initial.title,
    professionalSummary: initial.professionalSummary,
    phone: initial.phone,
    location: initial.location,
    websiteUrl: initial.websiteUrl,
  });
  const [experiences, setExperiences] = useState<CvFormSection[]>(
    initial.experiences,
  );
  const [educations, setEducations] = useState<CvFormSection[]>(
    initial.educations,
  );
  const [skills, setSkills] = useState<CvFormSection[]>(initial.skills);
  const [certifications, setCertifications] = useState<CvFormSection[]>(
    initial.certifications,
  );

  const payload = JSON.stringify({
    header,
    experiences,
    educations,
    skills,
    certifications,
  });

  function setHeaderField(field: keyof typeof header, value: string) {
    setHeader((prev) => ({ ...prev, [field]: value }));
  }

  function patchSection(
    list: CvFormSection[],
    setList: (v: CvFormSection[]) => void,
    id: string,
    field: string,
    value: string,
  ) {
    setList(list.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  }

  function addEntry(list: CvFormSection[], setList: (v: CvFormSection[]) => void) {
    setList([...list, { id: nextKey() }]);
  }

  function removeEntry(
    list: CvFormSection[],
    setList: (v: CvFormSection[]) => void,
    id: string,
  ) {
    setList(list.filter((item) => item.id !== id));
  }

  function monthInput(
    name: string,
    value: string,
    onPatch: (field: string, value: string) => void,
  ) {
    return (
      <input
        id={name}
        type="month"
        value={value}
        onChange={(e) => onPatch(name, e.target.value)}
        className={inputClass}
      />
    );
  }

  function removeButton(list: CvFormSection[], setList: (v: CvFormSection[]) => void, id: string) {
    return (
      <button
        type="button"
        onClick={() => removeEntry(list, setList, id)}
        className="mt-4 self-start rounded-lg border border-destructive px-3 py-1.5 text-sm font-medium text-destructive hover:bg-destructive-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        {f.removeEntry}
      </button>
    );
  }

  return (
    <form action={formAction} className="space-y-10">
      <input type="hidden" name="data" value={payload} />

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-primary">
          {f.personalHeading}
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="cv-title" className={labelClass}>
              {f.titleLabel}
            </label>
            <input
              id="cv-title"
              type="text"
              value={header.title}
              maxLength={CV_TITLE_MAX}
              placeholder={f.titlePlaceholder}
              onChange={(e) => setHeaderField("title", e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="cv-phone" className={labelClass}>
              {f.phoneLabel}
            </label>
            <input
              id="cv-phone"
              type="tel"
              value={header.phone}
              placeholder={f.phonePlaceholder}
              onChange={(e) => setHeaderField("phone", e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="cv-location" className={labelClass}>
              {f.locationLabel}
            </label>
            <input
              id="cv-location"
              type="text"
              value={header.location}
              maxLength={CV_LOCATION_MAX}
              placeholder={f.locationPlaceholder}
              onChange={(e) => setHeaderField("location", e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="cv-website" className={labelClass}>
              {f.websiteLabel}
            </label>
            <input
              id="cv-website"
              type="url"
              value={header.websiteUrl}
              placeholder={f.websitePlaceholder}
              onChange={(e) => setHeaderField("websiteUrl", e.target.value)}
              className={inputClass}
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="cv-summary" className={labelClass}>
              {f.summaryLabel}
            </label>
            <textarea
              id="cv-summary"
              rows={4}
              value={header.professionalSummary}
              maxLength={CV_SUMMARY_MAX}
              placeholder={f.summaryPlaceholder}
              onChange={(e) => setHeaderField("professionalSummary", e.target.value)}
              className={inputClass}
            />
          </div>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-primary">
            {f.experienceHeading}
          </h2>
          <button
            type="button"
            disabled={experiences.length >= CV_EXPERIENCES_MAX}
            onClick={() => addEntry(experiences, setExperiences)}
            className="rounded-lg border border-border px-3 py-1 text-sm font-semibold text-primary hover:bg-primary-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            {f.addExperience}
          </button>
        </div>
        <div className="mt-4 space-y-6">
          {experiences.length === 0 ? (
            <p className="text-sm text-subtle">{f.currentHint}</p>
          ) : null}
          {experiences.map((entry) => (
            <div
              key={entry.id}
              className="rounded-lg border border-border-subtle bg-surface-raised p-4"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor={`${entry.id}-employer`} className={labelClass}>
                    {f.employerLabel}
                  </label>
                  <input
                    id={`${entry.id}-employer`}
                    type="text"
                    value={entry.employer ?? ""}
                    maxLength={CV_STRING_SHORT_MAX}
                    onChange={(e) =>
                      patchSection(experiences, setExperiences, entry.id, "employer", e.target.value)
                    }
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor={`${entry.id}-role`} className={labelClass}>
                    {f.roleLabel}
                  </label>
                  <input
                    id={`${entry.id}-role`}
                    type="text"
                    value={entry.role ?? ""}
                    maxLength={CV_STRING_SHORT_MAX}
                    onChange={(e) =>
                      patchSection(experiences, setExperiences, entry.id, "role", e.target.value)
                    }
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor={`${entry.id}-location`} className={labelClass}>
                    {f.locationLabel}
                  </label>
                  <input
                    id={`${entry.id}-location`}
                    type="text"
                    value={entry.location ?? ""}
                    maxLength={CV_LOCATION_MAX}
                    onChange={(e) =>
                      patchSection(experiences, setExperiences, entry.id, "location", e.target.value)
                    }
                    className={inputClass}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor={`${entry.id}-start`} className={labelClass}>
                      {f.startMonthLabel}
                    </label>
                    {monthInput("startMonth", entry.startMonth ?? "", (name, value) =>
                      patchSection(experiences, setExperiences, entry.id, name, value),
                    )}
                  </div>
                  <div>
                    <label htmlFor={`${entry.id}-end`} className={labelClass}>
                      {f.endMonthLabel}
                    </label>
                    {monthInput("endMonth", entry.endMonth ?? "", (name, value) =>
                      patchSection(experiences, setExperiences, entry.id, name, value),
                    )}
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor={`${entry.id}-description`} className={labelClass}>
                    {f.descriptionLabel}
                  </label>
                  <textarea
                    id={`${entry.id}-description`}
                    rows={3}
                    value={entry.description ?? ""}
                    maxLength={CV_DESCRIPTION_MAX}
                    onChange={(e) =>
                      patchSection(experiences, setExperiences, entry.id, "description", e.target.value)
                    }
                    className={inputClass}
                  />
                </div>
              </div>
              {removeButton(experiences, setExperiences, entry.id)}
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-primary">
            {f.educationHeading}
          </h2>
          <button
            type="button"
            disabled={educations.length >= CV_EDUCATIONS_MAX}
            onClick={() => addEntry(educations, setEducations)}
            className="rounded-lg border border-border px-3 py-1 text-sm font-semibold text-primary hover:bg-primary-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            {f.addEducation}
          </button>
        </div>
        <div className="mt-4 space-y-6">
          {educations.length === 0 ? (
            <p className="text-sm text-subtle">{f.currentHint}</p>
          ) : null}
          {educations.map((entry) => (
            <div
              key={entry.id}
              className="rounded-lg border border-border-subtle bg-surface-raised p-4"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor={`${entry.id}-institution`} className={labelClass}>
                    {f.institutionLabel}
                  </label>
                  <input
                    id={`${entry.id}-institution`}
                    type="text"
                    value={entry.institution ?? ""}
                    maxLength={CV_STRING_SHORT_MAX}
                    onChange={(e) =>
                      patchSection(educations, setEducations, entry.id, "institution", e.target.value)
                    }
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor={`${entry.id}-qualification`} className={labelClass}>
                    {f.qualificationLabel}
                  </label>
                  <input
                    id={`${entry.id}-qualification`}
                    type="text"
                    value={entry.qualification ?? ""}
                    maxLength={CV_STRING_SHORT_MAX}
                    onChange={(e) =>
                      patchSection(educations, setEducations, entry.id, "qualification", e.target.value)
                    }
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor={`${entry.id}-field`} className={labelClass}>
                    {f.fieldOfStudyLabel}
                  </label>
                  <input
                    id={`${entry.id}-field`}
                    type="text"
                    value={entry.fieldOfStudy ?? ""}
                    maxLength={CV_STRING_SHORT_MAX}
                    onChange={(e) =>
                      patchSection(educations, setEducations, entry.id, "fieldOfStudy", e.target.value)
                    }
                    className={inputClass}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor={`${entry.id}-start`} className={labelClass}>
                      {f.startMonthLabel}
                    </label>
                    {monthInput("startMonth", entry.startMonth ?? "", (name, value) =>
                      patchSection(educations, setEducations, entry.id, name, value),
                    )}
                  </div>
                  <div>
                    <label htmlFor={`${entry.id}-end`} className={labelClass}>
                      {f.endMonthLabel}
                    </label>
                    {monthInput("endMonth", entry.endMonth ?? "", (name, value) =>
                      patchSection(educations, setEducations, entry.id, name, value),
                    )}
                  </div>
                </div>
              </div>
              {removeButton(educations, setEducations, entry.id)}
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-primary">
            {f.skillsHeading}
          </h2>
          <button
            type="button"
            disabled={skills.length >= CV_SKILLS_MAX}
            onClick={() => addEntry(skills, setSkills)}
            className="rounded-lg border border-border px-3 py-1 text-sm font-semibold text-primary hover:bg-primary-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            {f.addSkill}
          </button>
        </div>
        <div className="mt-4 space-y-3">
          {skills.map((entry) => (
            <div
              key={entry.id}
              className="flex flex-wrap items-end gap-4 rounded-lg border border-border-subtle bg-surface-raised p-4"
            >
              <div className="min-w-[220px] flex-1">
                <label htmlFor={`${entry.id}-name`} className={labelClass}>
                  {f.skillLabel}
                </label>
                <input
                  id={`${entry.id}-name`}
                  type="text"
                  value={entry.name ?? ""}
                  maxLength={CV_SKILL_NAME_MAX}
                  onChange={(e) =>
                    patchSection(skills, setSkills, entry.id, "name", e.target.value)
                  }
                  className={inputClass}
                />
              </div>
              <div className="min-w-[160px] flex-1">
                <label htmlFor={`${entry.id}-level`} className={labelClass}>
                  {f.levelLabel}
                </label>
                <input
                  id={`${entry.id}-level`}
                  type="text"
                  value={entry.level ?? ""}
                  maxLength={CV_LEVEL_MAX}
                  onChange={(e) =>
                    patchSection(skills, setSkills, entry.id, "level", e.target.value)
                  }
                  className={inputClass}
                />
              </div>
              {removeButton(skills, setSkills, entry.id)}
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-primary">
            {f.certificationsHeading}
          </h2>
          <button
            type="button"
            disabled={certifications.length >= CV_CERTIFICATIONS_MAX}
            onClick={() => addEntry(certifications, setCertifications)}
            className="rounded-lg border border-border px-3 py-1 text-sm font-semibold text-primary hover:bg-primary-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            {f.addCertification}
          </button>
        </div>
        <div className="mt-4 space-y-6">
          {certifications.length === 0 ? (
            <p className="text-sm text-subtle">{f.currentHint}</p>
          ) : null}
          {certifications.map((entry) => (
            <div
              key={entry.id}
              className="rounded-lg border border-border-subtle bg-surface-raised p-4"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor={`${entry.id}-name`} className={labelClass}>
                    {f.certificationLabel}
                  </label>
                  <input
                    id={`${entry.id}-name`}
                    type="text"
                    value={entry.name ?? ""}
                    maxLength={CV_STRING_SHORT_MAX}
                    onChange={(e) =>
                      patchSection(certifications, setCertifications, entry.id, "name", e.target.value)
                    }
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor={`${entry.id}-issuer`} className={labelClass}>
                    {f.issuerLabel}
                  </label>
                  <input
                    id={`${entry.id}-issuer`}
                    type="text"
                    value={entry.issuer ?? ""}
                    maxLength={CV_STRING_SHORT_MAX}
                    onChange={(e) =>
                      patchSection(certifications, setCertifications, entry.id, "issuer", e.target.value)
                    }
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor={`${entry.id}-issuedMonth`} className={labelClass}>
                    {f.issuedMonthLabel}
                  </label>
                  {monthInput("issuedMonth", entry.issuedMonth ?? "", (name, value) =>
                    patchSection(certifications, setCertifications, entry.id, name, value),
                  )}
                </div>
                <div>
                  <label htmlFor={`${entry.id}-credentialUrl`} className={labelClass}>
                    {f.credentialUrlLabel}
                  </label>
                  <input
                    id={`${entry.id}-credentialUrl`}
                    type="url"
                    value={entry.credentialUrl ?? ""}
                    onChange={(e) =>
                      patchSection(certifications, setCertifications, entry.id, "credentialUrl", e.target.value)
                    }
                    className={inputClass}
                  />
                </div>
              </div>
              {removeButton(certifications, setCertifications, entry.id)}
            </div>
          ))}
        </div>
      </section>

      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {t.cv.messages.genericError}
        </p>
      ) : null}
      {state.ok ? (
        <p role="status" className="text-sm font-medium text-success">
          {f.saved}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="focus-visible:outline-2 inline-flex items-center justify-center rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? f.saving : f.save}
        </button>
        <a
          href="/cv/preview"
          className="inline-flex items-center justify-center rounded-lg border border-border bg-surface px-6 py-2.5 text-sm font-semibold text-muted transition-colors hover:bg-surface-raised hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {t.cv.openPreview}
        </a>
      </div>
    </form>
  );
}