import React, { useState, useEffect } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Calculator,
  Check,
  CheckCircle2,
  FileText,
  LockKeyhole,
  MapPin,
  Sparkles,
  UserRound,
  AlertCircle,
  ShieldCheck,
  X,
  Phone,
  Send,
  Loader2,
} from "lucide-react";
import { API_BASE_URL } from "../config/api";
import { apiCache } from "../services/apiCache";
import {
  normalizeMatchScore,
  formatCurrency,
  formatValue,
  shouldExcludeForGender,
  calculateFallbackMatchScore,
  normalizeSchemeResults,
} from "../utils/schemeHelpers";
import {
  SectionIntro,
  TextField,
  SelectField,
  InfoBox,
  ReviewCard,
  EligibleSchemeCard,
  ReasonRow,
  EmptyState,
} from "./common/CommonUI";

export default function SchemeFinder({
  onBack,
  isLoggedIn,
  currentUser,
  onNavigate,
  onResultsReady,
}) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    fullName: "",
    age: "",
    gender: "",
    state: "",
    district: "",
    category: "",
    annualIncome: "",
    purpose: "",
    businessType: "",
    projectStage: "",
    projectCost: "",
    requiredLoan: "",
    course: "",
    institution: "",
    courseFee: "",
    educationLevel: "",
    ownContribution: "",
    existingLoan: "",
    outstandingAmount: "",
    overdue: "",
  });

  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  // Check if all required entries for the given step are completed by the user
  const isStepComplete = (stepNumber) => {
    if (stepNumber === 1) {
      const ageNum = Number(formData.age);
      const incomeNum = Number(formData.annualIncome);
      return Boolean(
        formData.fullName && formData.fullName.trim() &&
        formData.age && !isNaN(ageNum) && ageNum >= 18 && ageNum <= 100 &&
        formData.gender &&
        formData.category &&
        formData.state &&
        formData.district &&
        formData.annualIncome !== "" && formData.annualIncome !== null && !isNaN(incomeNum) && incomeNum >= 0
      );
    }
    if (stepNumber === 2) {
      return Boolean(formData.purpose);
    }
    if (stepNumber === 3) {
      if (formData.purpose === "education") {
        const feeNum = Number(formData.courseFee);
        return Boolean(
          formData.educationLevel &&
          formData.course && formData.course.trim() &&
          formData.institution && formData.institution.trim() &&
          formData.courseFee !== "" && !isNaN(feeNum) && feeNum > 0
        );
      }
      const costNum = Number(formData.projectCost);
      const loanNum = Number(formData.requiredLoan);
      return Boolean(
        formData.businessType &&
        formData.projectStage &&
        formData.projectCost !== "" && !isNaN(costNum) && costNum > 0 &&
        formData.requiredLoan !== "" && !isNaN(loanNum) && loanNum > 0 && loanNum <= costNum
      );
    }
    if (stepNumber === 4) {
      const ownNum = Number(formData.ownContribution);
      if (formData.ownContribution === "" || isNaN(ownNum) || ownNum < 0) return false;
      if (!formData.existingLoan) return false;
      if (formData.existingLoan === "yes") {
        const outNum = Number(formData.outstandingAmount);
        if (formData.outstandingAmount === "" || isNaN(outNum) || outNum < 0) return false;
        if (!formData.overdue) return false;
      }
      return true;
    }
    if (stepNumber === 5) {
      return isStepComplete(1) && isStepComplete(2) && isStepComplete(3) && isStepComplete(4);
    }
    return true;
  };

  const updateField = (field, value) => {
    setFormData((current) => ({
      ...current,
      [field]: value,
    }));
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
    if (error) {
      setError("");
    }
  };

  const validateStep = (stepNumber) => {
    const errors = {};

    if (stepNumber === 1) {
      if (!formData.fullName || !formData.fullName.trim()) {
        errors.fullName = "Please enter your full name.";
      }
      const ageNum = Number(formData.age);
      if (!formData.age || isNaN(ageNum) || ageNum < 18 || ageNum > 100) {
        errors.age = "Please enter a valid age (between 18 and 100).";
      }
      if (!formData.gender) {
        errors.gender = "Please select your gender.";
      }
      if (!formData.category) {
        errors.category = "Please select your category.";
      }
      if (!formData.state) {
        errors.state = "Please select your state.";
      }
      if (!formData.district) {
        errors.district = "Please select your district.";
      }
      if (formData.annualIncome === "" || formData.annualIncome === null || formData.annualIncome === undefined || Number(formData.annualIncome) < 0) {
        errors.annualIncome = "Please enter your annual family income.";
      }
    } else if (stepNumber === 2) {
      if (!formData.purpose) {
        errors.purpose = "Please select what you need financial support for.";
      }
    } else if (stepNumber === 3) {
      if (formData.purpose === "education") {
        if (!formData.educationLevel) {
          errors.educationLevel = "Please select your education level.";
        }
        if (!formData.course || !formData.course.trim()) {
          errors.course = "Please enter your course name.";
        }
        if (!formData.institution || !formData.institution.trim()) {
          errors.institution = "Please enter your institution name.";
        }
        const courseFeeNum = Number(formData.courseFee);
        if (!formData.courseFee || isNaN(courseFeeNum) || courseFeeNum <= 0) {
          errors.courseFee = "Please enter a valid course fee.";
        }
      } else {
        if (!formData.businessType) {
          errors.businessType = "Please select your project / business type.";
        }
        if (!formData.projectStage) {
          errors.projectStage = "Please select project stage.";
        }
        const projectCostNum = Number(formData.projectCost);
        if (!formData.projectCost || isNaN(projectCostNum) || projectCostNum <= 0) {
          errors.projectCost = "Please enter estimated project cost.";
        }
        const reqLoanNum = Number(formData.requiredLoan);
        if (!formData.requiredLoan || isNaN(reqLoanNum) || reqLoanNum <= 0) {
          errors.requiredLoan = "Please enter required loan amount.";
        } else if (projectCostNum && reqLoanNum > projectCostNum) {
          errors.requiredLoan = "Required loan cannot exceed estimated project cost.";
        }
      }
    } else if (stepNumber === 4) {
      if (formData.ownContribution === "" || formData.ownContribution === null || formData.ownContribution === undefined || Number(formData.ownContribution) < 0) {
        errors.ownContribution = "Please enter your own contribution (enter 0 if none).";
      }
      if (!formData.existingLoan) {
        errors.existingLoan = "Please select whether you have an existing loan.";
      } else if (formData.existingLoan === "yes") {
        if (formData.outstandingAmount === "" || formData.outstandingAmount === null || formData.outstandingAmount === undefined || Number(formData.outstandingAmount) < 0) {
          errors.outstandingAmount = "Please enter outstanding loan amount.";
        }
        if (!formData.overdue) {
          errors.overdue = "Please specify if you have any existing overdue.";
        }
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const nextStep = () => {
    const isComplete = isStepComplete(step);
    const isValid = validateStep(step);
    if (!isComplete || !isValid) {
      setError("Please complete all required fields on this page before moving to the next step.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setError("");
    if (step < 5) {
      setStep((current) => current + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const previousStep = () => {
    setError("");
    if (step > 1) {
      setStep((current) => current - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const runSchemeMatching = async () => {
    setLoading(true);
    setError("");

    if (!formData.category) {
      setLoading(false);
      setError("Please select your category before finding schemes.");
      return;
    }

    if (!formData.gender) {
      setLoading(false);
      setError("Please select your gender before finding schemes.");
      return;
    }

    if (!formData.annualIncome) {
      setLoading(false);
      setError("Please enter your annual family income before finding schemes.");
      return;
    }

    if (!formData.purpose) {
      setLoading(false);
      setError("Please select your requirement before finding schemes.");
      return;
    }

    // Check profile cache to avoid redundant AI calls
    const profileKey = JSON.stringify({
      category: formData.category,
      gender: formData.gender,
      annualIncome: formData.annualIncome,
      purpose: formData.purpose,
      projectCost: formData.projectCost,
      requiredLoan: formData.requiredLoan,
      educationLevel: formData.educationLevel,
      state: formData.state,
      district: formData.district,
    });

    // Persist profile to SQLite for logged-in user
    const token = localStorage.getItem("scheme_saathi_token");
    if (token) {
      fetch(`${API_BASE_URL}/api/auth/profile`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      }).catch(() => {});
    }

    const cached = apiCache.getSchemeMatch(profileKey);
    if (cached) {
      setResults(cached);
      if (onResultsReady) {
        onResultsReady(cached, formData);
      }
      setLoading(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const payload = {
      category: formData.category,
      gender: formData.gender || null,
      annual_income: Number(formData.annualIncome || 0),
      purpose: formData.purpose || null,
      project_cost: formData.projectCost ? Number(formData.projectCost) : null,
      required_loan: formData.requiredLoan ? Number(formData.requiredLoan) : null,
      education_level: formData.educationLevel || null,
      state: formData.state || null,
      district: formData.district || null,
    };

    try {
      const response = await fetch(`${API_BASE_URL}/api/schemes/match`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let errorMessage = "Unable to get scheme recommendations.";
        try {
          const errorData = await response.json();
          if (errorData?.detail) {
            errorMessage = Array.isArray(errorData.detail)
              ? errorData.detail.map((item) => item.msg || String(item)).join(", ")
              : String(errorData.detail);
          }
        } catch {
          // Keep default
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      const normalizedResults = normalizeSchemeResults(data, formData);

      // Cache result for this profile
      apiCache.setSchemeMatch(profileKey, normalizedResults);
      apiCache.saveRecommendations(normalizedResults, formData);

      setResults(normalizedResults);

      if (onResultsReady) {
        onResultsReady(normalizedResults, formData);
      }

      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to connect to the Scheme Saathi backend."
      );
    } finally {
      setLoading(false);
    }
  };

  const isBusiness = ["new_business", "business_expansion", "agriculture"].includes(
    formData.purpose
  );
  const isEducation = formData.purpose === "education";

  const stepTitles = [
    "About You",
    "Your Requirement",
    "Project / Education",
    "Financial Profile",
    "Review",
  ];

  const progress = (step / 5) * 100;

  if (!isLoggedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f4f8fb] px-6">
        <div className="rounded-2xl border border-[#d8e3e9] bg-white p-8 text-center shadow-sm">
          <LockKeyhole size={32} className="mx-auto text-[#1769a8]" />
          <h2 className="mt-4 font-serif text-2xl font-bold text-[#172a43]">
            Login required
          </h2>
          <p className="mt-2 text-sm text-[#718096]">
            Please sign in before starting personalized scheme matching.
          </p>
          <button
            onClick={onBack}
            className="mt-6 rounded-lg bg-[#145c91] px-6 py-3 text-sm font-bold text-white"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  if (results) {
    return (
      <SchemeResults
        results={results}
        formData={formData}
        currentUser={currentUser}
        onNavigate={onNavigate}
        onBack={() => {
          setResults(null);
          setStep(5);
          setError("");
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
        onHome={onBack}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f8fb]">
      <header className="border-b border-[#dce4ea] bg-white">
        <div className="mx-auto flex min-h-[80px] max-w-[1200px] items-center justify-between px-6">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-sm font-semibold text-[#53657b] transition hover:text-[#145c91]"
          >
            <ArrowLeft size={18} />
            Back to Home
          </button>

          <div className="hidden items-center gap-3 sm:flex">
            <div className="relative flex h-9 w-9 items-center justify-center text-[#c6a56b]">
              <div className="absolute inset-1 rotate-45 rounded-md border-2 border-[#c6a56b]" />
              <Sparkles size={17} />
            </div>
            <div>
              <p className="font-serif text-[17px] font-bold tracking-wide text-[#172a43]">
                SCHEME SAATHI
              </p>
              <p className="text-[9px] font-medium uppercase tracking-[0.12em] text-[#8090a0]">
                Scheme Finder
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold text-[#64758a]">
            <LockKeyhole size={15} />
            Signed-in profile
          </div>
        </div>
      </header>

      <div className="border-b border-[#dfe7ed] bg-white">
        <div className="mx-auto max-w-[1200px] px-6 py-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#1769a8]">
                STEP {String(step).padStart(2, "0")} OF 05
              </p>
              <h1 className="mt-1 font-serif text-2xl font-bold text-[#172a43]">
                {stepTitles[step - 1]}
              </h1>
            </div>

            <div className="w-full md:w-[360px]">
              <div className="mb-2 flex justify-between text-[11px] font-semibold text-[#7c8998]">
                <span>Your progress</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[#e3ebf0]">
                <div
                  className="h-full rounded-full bg-[#1769a8] transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>

          <div className="mt-6 hidden grid-cols-5 gap-3 md:grid">
            {stepTitles.map((title, index) => {
              const currentStep = index + 1;
              const completed = currentStep < step;
              const active = currentStep === step;

              return (
                <div key={title} className="flex items-center gap-2">
                  <div
                    className={[
                      "flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold",
                      completed
                        ? "bg-[#1769a8] text-white"
                        : active
                        ? "border-2 border-[#1769a8] bg-white text-[#1769a8]"
                        : "bg-[#eef3f6] text-[#8492a0]",
                    ].join(" ")}
                  >
                    {completed ? <Check size={14} /> : currentStep}
                  </div>
                  <span
                    className={[
                      "text-[11px] font-semibold",
                      active ? "text-[#1769a8]" : "text-[#82909f]",
                    ].join(" ")}
                  >
                    {title}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-[1000px] px-6 py-10 pb-20">
        <div className="rounded-2xl border border-[#d9e2e9] bg-white p-6 shadow-[0_12px_35px_rgba(46,75,98,0.08)] md:p-9">
          {step === 1 && (
            <StepOne
              formData={formData}
              updateField={updateField}
              errors={fieldErrors}
            />
          )}

          {step === 2 && (
            <StepTwo
              formData={formData}
              updateField={updateField}
              errors={fieldErrors}
            />
          )}

          {step === 3 && (
            <StepThree
              formData={formData}
              updateField={updateField}
              isBusiness={isBusiness}
              isEducation={isEducation}
              errors={fieldErrors}
            />
          )}

          {step === 4 && (
            <StepFour
              formData={formData}
              updateField={updateField}
              errors={fieldErrors}
            />
          )}

          {step === 5 && <StepFive formData={formData} />}

          {error && (
            <div className="mt-7 flex items-start gap-3 rounded-xl border border-[#edc8c8] bg-[#fff5f5] p-4 text-sm text-[#a03a3a]">
              <AlertCircle size={19} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-bold">Scheme matching failed</p>
                <p className="mt-1 leading-5">{error}</p>
                {!error.includes("Please") && (
                  <p className="mt-2 text-xs text-[#9b6666]">
                    Make sure the FastAPI backend is running on port 8000.
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="mt-10 flex flex-col-reverse gap-3 border-t border-[#e1e7ec] pt-7 sm:flex-row sm:items-center sm:justify-between">
            <button
              onClick={previousStep}
              disabled={step === 1}
              className={[
                "flex items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold",
                step === 1
                  ? "cursor-not-allowed text-[#b6bec7]"
                  : "text-[#52657b] transition hover:bg-[#f3f7fa]",
              ].join(" ")}
            >
              <ArrowLeft size={17} />
              Back
            </button>

            {step < 5 ? (
              <button
                onClick={nextStep}
                disabled={!isStepComplete(step)}
                title={
                  !isStepComplete(step)
                    ? "Please complete all required fields on this page to continue"
                    : "Continue to next step"
                }
                className={[
                  "flex items-center justify-center gap-2 rounded-lg px-7 py-3.5 text-sm font-bold shadow-md transition",
                  !isStepComplete(step)
                    ? "cursor-not-allowed bg-[#cfdbe3] text-[#718596] shadow-none"
                    : "bg-[#145c91] text-white hover:bg-[#104d7b]",
                ].join(" ")}
              >
                Continue
                <ArrowRight size={17} />
              </button>
            ) : (
              <button
                onClick={runSchemeMatching}
                disabled={loading || !isStepComplete(5)}
                title={
                  !isStepComplete(5)
                    ? "Please complete all required entries before submitting"
                    : "Find My Schemes"
                }
                className={[
                  "flex items-center justify-center gap-2 rounded-lg px-7 py-3.5 text-sm font-bold shadow-md transition",
                  loading || !isStepComplete(5)
                    ? "cursor-not-allowed bg-[#cfdbe3] text-[#718596] shadow-none"
                    : "bg-[#145c91] text-white hover:bg-[#104d7b]",
                ].join(" ")}
              >
                {loading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Finding Schemes...
                  </>
                ) : (
                  <>
                    Find My Schemes
                    <Sparkles size={17} />
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function StepOne({ formData, updateField, errors = {} }) {
  const [statesList, setStatesList] = useState([]);
  const [districtsList, setDistrictsList] = useState([]);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState("");

  const fetchStates = async () => {
    const cached = apiCache.getStates();
    if (cached && cached.length > 0) {
      setStatesList(cached);
      setLocationLoading(false);
      return;
    }
    setLocationLoading(true);
    setLocationError("");
    try {
      const response = await fetch(`${API_BASE_URL}/api/locations/states`);
      if (!response.ok) throw new Error("Failed to fetch states");
      const data = await response.json();
      const list = data.states || [];
      apiCache.setStates(list);
      setStatesList(list);
    } catch {
      setLocationError("Failed to load states. Please refresh the page.");
      setStatesList([]);
    } finally {
      setLocationLoading(false);
    }
  };

  const fetchDistricts = async (state) => {
    if (!state) return;
    const cached = apiCache.getDistricts(state);
    if (cached && cached.length > 0) {
      setDistrictsList(cached);
      return;
    }
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/locations/states/${encodeURIComponent(state)}/districts`
      );
      if (!response.ok) throw new Error("Failed to fetch districts");
      const data = await response.json();
      const list = data.districts || [];
      apiCache.setDistricts(state, list);
      setDistrictsList(list);
    } catch {
      setDistrictsList([]);
    }
  };

  useEffect(() => {
    fetchStates();
  }, []);

  useEffect(() => {
    if (formData.state) {
      fetchDistricts(formData.state);
    } else {
      setDistrictsList((prev) => (prev.length > 0 ? [] : prev));
    }
  }, [formData.state]);

  const handleStateChange = (value) => {
    updateField("state", value);
    updateField("district", "");
  };

  return (
    <div>
      <SectionIntro
        eyebrow="PERSONAL INFORMATION"
        title="Tell us a little about yourself"
        description="These details help Scheme Saathi identify the schemes that may apply to your profile."
      />

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <TextField
          label="Full Name"
          placeholder="Enter your full name"
          value={formData.fullName}
          onChange={(value) => updateField("fullName", value)}
          required
          error={errors.fullName}
        />

        <TextField
          label="Age"
          placeholder="Enter your age"
          type="number"
          value={formData.age}
          onChange={(value) => updateField("age", value)}
          required
          error={errors.age}
        />

        <SelectField
          label="Gender"
          value={formData.gender}
          onChange={(value) => updateField("gender", value)}
          required
          error={errors.gender}
          options={[
            { value: "female", label: "Female" },
            { value: "male", label: "Male" },
            { value: "other", label: "Other" },
            { value: "prefer_not", label: "Prefer not to say" },
          ]}
        />

        <SelectField
          label="Category"
          helper="Your category will be checked against each scheme's actual eligibility rules."
          value={formData.category}
          onChange={(value) => updateField("category", value)}
          required
          error={errors.category}
          options={[
            { value: "SC", label: "Scheduled Caste (SC)" },
            { value: "ST", label: "Scheduled Tribe (ST)" },
            { value: "OBC", label: "Other Backward Class (OBC)" },
            { value: "GENERAL", label: "General" },
            { value: "EWS", label: "Economically Weaker Section (EWS)" },
            { value: "SAFAI_KARAMCHARI", label: "Safai Karamchari" },
          ]}
        />

        <SelectField
          label="State"
          value={formData.state}
          onChange={handleStateChange}
          required
          error={errors.state}
          options={
            locationLoading
              ? []
              : statesList.map((s) => ({ value: s.name, label: s.name }))
          }
          helper={
            locationError
              ? locationError
              : locationLoading
              ? "Loading states..."
              : undefined
          }
        />

        <SelectField
          label="District"
          value={formData.district}
          onChange={(value) => updateField("district", value)}
          required
          error={errors.district}
          options={
            !formData.state
              ? []
              : districtsList.map((d) => ({ value: d, label: d }))
          }
          helper={!formData.state ? "Select a state first" : undefined}
          disabled={!formData.state}
        />

        <TextField
          label="Annual Family Income"
          prefix="₹"
          type="number"
          placeholder="e.g. 320000"
          value={formData.annualIncome}
          onChange={(value) => updateField("annualIncome", value)}
          required
          error={errors.annualIncome}
        />
      </div>

      <InfoBox icon={<ShieldCheck size={18} />}>
        Scheme Saathi first applies rule-based scheme eligibility. AI can
        assist with ranking and explanation only after eligible schemes have
        been identified.
      </InfoBox>
    </div>
  );
}

function StepTwo({ formData, updateField, errors = {} }) {
  const purposes = [
    {
      value: "new_business",
      icon: <Sparkles size={24} />,
      title: "Start a New Business",
      text: "I want financing to start a new income-generating activity.",
    },
    {
      value: "business_expansion",
      icon: <ArrowRight size={24} />,
      title: "Expand Existing Business",
      text: "I already have a business and want to grow it.",
    },
    {
      value: "agriculture",
      icon: <MapPin size={24} />,
      title: "Agriculture / Allied",
      text: "My requirement is related to agriculture or allied activities.",
    },
    {
      value: "education",
      icon: <FileText size={24} />,
      title: "Education",
      text: "I need financing for eligible education or professional study.",
    },
    {
      value: "skill",
      icon: <Bot size={24} />,
      title: "Skill / Vocational",
      text: "I need support related to skill or vocational development.",
    },
  ];

  return (
    <div>
      <SectionIntro
        eyebrow="YOUR REQUIREMENT"
        title="What do you need support for?"
        description="Choose the option that most closely matches your current financial requirement."
      />

      {errors.purpose && (
        <div className="mt-5 flex items-center gap-2.5 rounded-xl border border-red-300 bg-red-50 p-3.5 text-xs font-semibold text-red-600">
          <AlertCircle size={16} className="shrink-0" />
          <span>{errors.purpose}</span>
        </div>
      )}

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {purposes.map((purpose) => {
          const selected = formData.purpose === purpose.value;

          return (
            <button
              key={purpose.value}
              type="button"
              onClick={() => updateField("purpose", purpose.value)}
              className={[
                "group relative flex items-start gap-4 rounded-xl border-2 p-5 text-left transition",
                selected
                  ? "border-[#1769a8] bg-[#eef7fb] shadow-sm"
                  : errors.purpose
                  ? "border-red-300 bg-red-50/10 hover:border-red-400"
                  : "border-[#dce4ea] bg-white hover:border-[#a9c8da] hover:bg-[#f8fbfd]",
              ].join(" ")}
            >
              <div
                className={[
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
                  selected ? "bg-[#1769a8] text-white" : "bg-[#e8f3f8] text-[#1769a8]",
                ].join(" ")}
              >
                {purpose.icon}
              </div>

              <div className="pr-7">
                <h3 className="font-serif text-[17px] font-bold text-[#1d3048]">
                  {purpose.title}
                </h3>
                <p className="mt-1 text-[12px] leading-5 text-[#718096]">
                  {purpose.text}
                </p>
              </div>

              {selected && (
                <div className="absolute right-4 top-4 flex h-6 w-6 items-center justify-center rounded-full bg-[#1769a8] text-white">
                  <Check size={14} />
                </div>
              )}
            </button>
          );
        })}
      </div>

      <InfoBox icon={<Bot size={18} />}>
        Your selected purpose helps the backend identify compatible schemes.
        Final eligibility remains rule-based.
      </InfoBox>
    </div>
  );
}

function StepThree({ formData, updateField, isBusiness, isEducation, errors = {} }) {
  return (
    <div>
      <SectionIntro
        eyebrow="PROJECT / EDUCATION"
        title={
          isEducation
            ? "Tell us about your education requirement"
            : "Tell us about your project"
        }
        description={
          isEducation
            ? "These details will help identify applicable educational financing options."
            : "Provide your project details so the backend can compare them against scheme rules."
        }
      />

      {isEducation ? (
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <SelectField
            label="Education Level"
            value={formData.educationLevel}
            onChange={(value) => updateField("educationLevel", value)}
            required
            error={errors.educationLevel}
            options={[
              { value: "professional", label: "Professional / Technical" },
              { value: "undergraduate", label: "Undergraduate" },
              { value: "postgraduate", label: "Postgraduate" },
              { value: "other", label: "Other" },
            ]}
          />

          <TextField
            label="Course"
            placeholder="e.g. B.Tech Computer Science"
            value={formData.course}
            onChange={(value) => updateField("course", value)}
            required
            error={errors.course}
          />

          <TextField
            label="Institution"
            placeholder="Enter institution name"
            value={formData.institution}
            onChange={(value) => updateField("institution", value)}
            required
            error={errors.institution}
          />

          <TextField
            label="Course Fee"
            prefix="₹"
            type="number"
            placeholder="e.g. 800000"
            value={formData.courseFee}
            onChange={(value) => updateField("courseFee", value)}
            required
            error={errors.courseFee}
          />
        </div>
      ) : (
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <SelectField
            label="Project / Business Type"
            value={formData.businessType}
            onChange={(value) => updateField("businessType", value)}
            required
            error={errors.businessType}
            options={[
              { value: "tailoring", label: "Tailoring / Garment" },
              { value: "retail", label: "Retail / Shop" },
              { value: "food", label: "Food / Catering" },
              { value: "dairy", label: "Dairy / Animal Husbandry" },
              { value: "services", label: "Service Business" },
              { value: "manufacturing", label: "Small Manufacturing" },
              { value: "other", label: "Other" },
            ]}
          />

          <SelectField
            label="Project Stage"
            value={formData.projectStage}
            onChange={(value) => updateField("projectStage", value)}
            required
            error={errors.projectStage}
            options={[
              { value: "new", label: "New Project" },
              { value: "existing", label: "Existing Project" },
            ]}
          />

          <TextField
            label="Estimated Project Cost"
            prefix="₹"
            type="number"
            placeholder="e.g. 300000"
            value={formData.projectCost}
            onChange={(value) => updateField("projectCost", value)}
            required
            error={errors.projectCost}
          />

          <TextField
            label="Required Loan Amount"
            prefix="₹"
            type="number"
            placeholder="e.g. 250000"
            value={formData.requiredLoan}
            onChange={(value) => updateField("requiredLoan", value)}
            required
            error={errors.requiredLoan}
          />
        </div>
      )}

      {isBusiness && (
        <div className="mt-6 rounded-xl border border-[#dbe6ec] bg-[#f8fbfd] p-5">
          <div className="flex gap-3">
            <Bot className="mt-0.5 shrink-0 text-[#1769a8]" size={19} />
            <div>
              <p className="text-sm font-bold text-[#284159]">Why we ask this</p>
              <p className="mt-1 text-xs leading-5 text-[#6d7d8f]">
                Project type and amount are important inputs for scheme-level financial eligibility checks.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StepFour({ formData, updateField, errors = {} }) {
  return (
    <div>
      <SectionIntro
        eyebrow="FINANCIAL PROFILE"
        title="A little more about your finances"
        description="This information can support scheme and channel-partner matching."
      />

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <TextField
          label="Your Own Contribution"
          prefix="₹"
          type="number"
          placeholder="e.g. 50000"
          value={formData.ownContribution}
          onChange={(value) => updateField("ownContribution", value)}
          required
          error={errors.ownContribution}
        />

        <SelectField
          label="Do you have an existing loan?"
          value={formData.existingLoan}
          onChange={(value) => updateField("existingLoan", value)}
          required
          error={errors.existingLoan}
          options={[
            { value: "no", label: "No" },
            { value: "yes", label: "Yes" },
          ]}
        />

        {formData.existingLoan === "yes" && (
          <>
            <TextField
              label="Outstanding Loan Amount"
              prefix="₹"
              type="number"
              placeholder="e.g. 90000"
              value={formData.outstandingAmount}
              onChange={(value) => updateField("outstandingAmount", value)}
              required
              error={errors.outstandingAmount}
            />

            <SelectField
              label="Any Existing Overdue?"
              value={formData.overdue}
              onChange={(value) => updateField("overdue", value)}
              required
              error={errors.overdue}
              options={[
                { value: "no", label: "No" },
                { value: "yes", label: "Yes" },
                { value: "not_sure", label: "Not sure" },
              ]}
            />
          </>
        )}
      </div>

      <InfoBox icon={<ShieldCheck size={18} />}>
        Financial information supports eligibility and partner-routing
        decisions. It does not itself guarantee loan approval.
      </InfoBox>
    </div>
  );
}

function StepFive({ formData }) {
  const purposeLabels = {
    new_business: "Start a New Business",
    business_expansion: "Expand Existing Business",
    agriculture: "Agriculture / Allied",
    education: "Education",
    skill: "Skill / Vocational",
  };

  const genderLabels = {
    female: "Female",
    male: "Male",
    other: "Other",
    prefer_not: "Prefer not to say",
  };

  const categoryLabels = {
    SC: "Scheduled Caste (SC)",
    ST: "Scheduled Tribe (ST)",
    OBC: "Other Backward Class (OBC)",
    GENERAL: "General",
    EWS: "Economically Weaker Section (EWS)",
    SAFAI_KARAMCHARI: "Safai Karamchari",
  };

  return (
    <div>
      <SectionIntro
        eyebrow="FINAL REVIEW"
        title="Review your information"
        description="Please check your details before sending your profile to the scheme-matching backend."
      />

      <div className="mt-8 grid gap-5 md:grid-cols-2">
        <ReviewCard
          title="Personal Information"
          icon={<UserRound size={20} />}
          rows={[
            ["Name", formData.fullName || "Not provided"],
            ["Age", formData.age || "Not provided"],
            ["Gender", genderLabels[formData.gender] || "Not selected"],
            ["Category", categoryLabels[formData.category] || "Not selected"],
            ["State", formatValue(formData.state)],
            ["District", formData.district || "Not provided"],
            [
              "Annual Family Income",
              formData.annualIncome
                ? formatCurrency(formData.annualIncome)
                : "Not provided",
            ],
          ]}
        />

        <ReviewCard
          title="Requirement"
          icon={<Sparkles size={20} />}
          rows={[
            ["Purpose", purposeLabels[formData.purpose] || "Not selected"],
            ["Business Type", formatValue(formData.businessType)],
            ["Project Stage", formatValue(formData.projectStage)],
            [
              "Project Cost",
              formData.projectCost
                ? formatCurrency(formData.projectCost)
                : "Not provided",
            ],
            [
              "Required Loan",
              formData.requiredLoan
                ? formatCurrency(formData.requiredLoan)
                : "Not provided",
            ],
          ]}
        />

        <ReviewCard
          title="Education"
          icon={<FileText size={20} />}
          rows={[
            ["Level", formatValue(formData.educationLevel)],
            ["Course", formData.course || "Not applicable"],
            ["Institution", formData.institution || "Not applicable"],
            [
              "Course Fee",
              formData.courseFee
                ? formatCurrency(formData.courseFee)
                : "Not applicable",
            ],
          ]}
        />

        <ReviewCard
          title="Financial Profile"
          icon={<Calculator size={20} />}
          rows={[
            [
              "Own Contribution",
              formData.ownContribution
                ? formatCurrency(formData.ownContribution)
                : "Not provided",
            ],
            [
              "Existing Loan",
              formData.existingLoan === "yes"
                ? "Yes"
                : formData.existingLoan === "no"
                ? "No"
                : "Not selected",
            ],
            [
              "Outstanding",
              formData.outstandingAmount
                ? formatCurrency(formData.outstandingAmount)
                : "Not applicable",
            ],
            [
              "Overdue",
              formData.overdue
                ? formatValue(formData.overdue)
                : "Not applicable",
            ],
          ]}
        />
      </div>

      <div className="mt-7 rounded-xl border border-[#cfe0ea] bg-[#edf7fb] p-5">
        <div className="flex gap-3">
          <Bot className="mt-0.5 shrink-0 text-[#1769a8]" size={20} />
          <div>
            <p className="font-bold text-[#244058]">What happens after you submit?</p>
            <p className="mt-1 text-xs leading-6 text-[#62768a]">
              Scheme Saathi sends these details to FastAPI. The backend
              applies rule-based eligibility first. Eligible schemes are
              then returned for recommendation and ranking.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function SchemeResults({ results, formData, currentUser, onNavigate, onBack, onHome }) {
  const primaryEligible = Array.isArray(results?.primary?.eligible)
    ? results.primary.eligible
    : [];

  const primaryIneligible = Array.isArray(results?.primary?.ineligible)
    ? results.primary.ineligible
    : [];

  const secondaryEligible = Array.isArray(results?.secondary?.eligible)
    ? results.secondary.eligible
    : [];

  const primaryMatchCount = primaryEligible.length;
  const secondaryMatchCount = secondaryEligible.length;
  const topScheme = primaryEligible[0] || null;

  // Application submission states
  const [applyModalOpen, setApplyModalOpen] = useState(false);
  const [selectedSchemeToApply, setSelectedSchemeToApply] = useState(null);
  const [applicantNameInput, setApplicantNameInput] = useState("");
  const [mobileInput, setMobileInput] = useState("");
  const [isApplying, setIsApplying] = useState(false);
  const [applySuccessData, setApplySuccessData] = useState(null);
  const [applyError, setApplyError] = useState("");

  const handleInitiateApply = (scheme) => {
    const target = scheme || topScheme || (results?.schemes || []).find((s) => s.is_eligible) || results?.schemes?.[0];
    if (!target) return;
    setSelectedSchemeToApply(target);
    setApplicantNameInput(currentUser?.name || formData.fullName || "");
    setMobileInput(currentUser?.identifier || "");
    setApplyError("");
    setApplyModalOpen(true);
  };

  const handleConfirmSubmitApplication = async () => {
    const phoneClean = mobileInput.replace(/\D/g, "");
    if (!phoneClean || phoneClean.length !== 10) {
      setApplyError("Please enter a valid 10-digit Indian mobile number to register and track your application.");
      return;
    }
    const nameClean = applicantNameInput.trim() || formData.fullName || currentUser?.name || "Applicant";

    setIsApplying(true);
    setApplyError("");

    const token = localStorage.getItem("scheme_saathi_token");
    const headers = { "Content-Type": "application/json" };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const payload = {
      applicant_name: nameClean,
      mobile: phoneClean,
      scheme_id: selectedSchemeToApply?.scheme_id || "TL",
      scheme_name: selectedSchemeToApply?.scheme_name || "Term Loan",
      loan_amount: formatCurrency(formData.requiredLoan || 150000),
      purpose: formatValue(formData.purpose || "new_business"),
      authority: "National Scheduled Castes Finance and Development Corporation (NSFDC)",
    };

    try {
      const res = await fetch(`${API_BASE_URL}/api/applications/submit`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        const app = data.application || data;
        setApplySuccessData(app);
        setApplyModalOpen(false);

        // Cache in localStorage for client-side instant tracking fallback
        try {
          const saved = JSON.parse(localStorage.getItem("scheme_saathi_applications") || "{}");
          saved[app.application_id] = app;
          if (app.mobile) saved[app.mobile] = app;
          localStorage.setItem("scheme_saathi_applications", JSON.stringify(saved));
          localStorage.setItem("scheme_saathi_recent_track", app.application_id);
        } catch {
          // ignore
        }
      } else {
        const err = await res.json().catch(() => ({}));
        setApplyError(err.detail || "Failed to submit application. Please check details.");
      }
    } catch {
      setApplyError("Could not reach backend server to submit application.");
    } finally {
      setIsApplying(false);
    }
  };

  const backendMatchScore =
    results?.match_score ??
    results?.overall_match_score ??
    topScheme?.match_score ??
    null;

  const matchScore =
    backendMatchScore !== null && backendMatchScore !== undefined
      ? normalizeMatchScore(backendMatchScore)
      : calculateFallbackMatchScore(topScheme, formData);

  const topSchemeScore =
    topScheme && shouldExcludeForGender(topScheme, formData)
      ? 0
      : normalizeMatchScore(topScheme?.match_score) ??
        calculateFallbackMatchScore(topScheme, formData);

  return (
    <div className="min-h-screen bg-[#f4f8fb]">
      <header className="sticky top-0 z-50 border-b border-[#dce4ea] bg-white/95 backdrop-blur">
        <div className="mx-auto flex min-h-[82px] max-w-[1200px] items-center justify-between px-6">
          <button
            onClick={onHome}
            className="flex items-center gap-2 text-sm font-semibold text-[#53657b] transition hover:text-[#145c91]"
          >
            <ArrowLeft size={18} />
            Home
          </button>

          <div className="flex items-center gap-3">
            <div className="relative flex h-9 w-9 items-center justify-center text-[#c6a56b]">
              <div className="absolute inset-1 rotate-45 rounded-md border-2 border-[#c6a56b]" />
              <Sparkles size={17} />
            </div>
            <p className="font-serif text-[18px] font-bold tracking-wide text-[#172a43]">
              SCHEME SAATHI
            </p>
          </div>

          <span className="hidden text-xs font-semibold text-[#718096] sm:block">
            Matching Results
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-[1200px] px-6 py-10 pb-20">
        <div className="rounded-2xl border border-[#cee0e8] bg-[#eaf6fa] p-7">
          <div className="flex flex-col justify-between gap-8 md:flex-row md:items-center md:gap-10">
            <div className="min-w-0">
              <p className="text-[11px] font-bold tracking-[0.17em] text-[#1769a8]">
                SCHEME ELIGIBILITY CHECK COMPLETE
              </p>
              <h1 className="mt-2 font-serif text-3xl font-bold text-[#17334f] md:text-4xl">
                Here are the schemes you may be eligible for.
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[#60758a]">
                Eligibility is determined by the backend rule engine.
                Women-focused schemes are additionally filtered by the
                applicant's gender before recommendation.
              </p>
            </div>

            <div className="flex h-[122px] w-[122px] shrink-0 flex-col items-center justify-center rounded-full border-[8px] border-white bg-[#d6eaf2] shadow-sm">
              <div className="flex h-[44px] items-baseline justify-center">
                <span className="font-serif text-[36px] font-bold leading-none text-[#145c91]">
                  {matchScore !== null ? matchScore : "—"}
                </span>
                {matchScore !== null && (
                  <span className="ml-0.5 font-serif text-[18px] font-bold leading-none text-[#145c91]">
                    %
                  </span>
                )}
              </div>
              <span className="mt-1 text-center text-[9px] font-bold uppercase tracking-[0.12em] text-[#6a7d8e]">
                Match Score
              </span>
            </div>
          </div>
        </div>

        {applySuccessData && (
          <div className="mt-8 rounded-2xl border-2 border-[#20835c] bg-[#eef8f3] p-7 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#20835c] text-white shadow-sm">
                  <CheckCircle2 size={26} />
                </div>
                <div>
                  <span className="rounded bg-[#20835c]/20 px-2.5 py-0.5 text-xs font-bold text-[#1a6e4d]">
                    APPLICATION SUBMITTED SUCCESSFULLY
                  </span>
                  <h3 className="mt-1 font-serif text-2xl font-bold text-[#14283e]">
                    Application ID: <span className="font-mono text-[#145c91]">{applySuccessData.application_id}</span>
                  </h3>
                  <p className="mt-1 text-xs text-[#4f6479]">
                    Registered for: <strong className="text-[#172a43]">{applySuccessData.applicant_name}</strong> · Mobile:{" "}
                    <strong className="text-[#172a43]">{applySuccessData.mobile_masked || applySuccessData.mobile}</strong> · Scheme:{" "}
                    <strong className="text-[#172a43]">{applySuccessData.scheme_name}</strong>
                  </p>
                  <p className="mt-1 text-[11px] text-[#20835c] font-semibold">
                    Status: Stage 1 - Application Submitted (Sent to Author Desk for Scrutiny)
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => onNavigate ? onNavigate("track") : null}
                  className="flex items-center gap-2 rounded-xl bg-[#145c91] px-5 py-3 text-xs font-bold text-white shadow-sm transition hover:bg-[#104d7b]"
                >
                  <FileText size={15} />
                  <span>Track Application Status</span>
                </button>
                <button
                  onClick={() => onNavigate ? onNavigate("admin_portal") : null}
                  className="flex items-center gap-2 rounded-xl border border-[#145c91] bg-white px-5 py-3 text-xs font-bold text-[#145c91] shadow-sm transition hover:bg-[#f0f7fc]"
                >
                  <ShieldCheck size={15} />
                  <span>Open Author Desk</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {topScheme && (
          <section className="mt-8">
            <div className="mb-4 flex items-center gap-2">
              <Sparkles size={18} className="text-[#c19855]" />
              <p className="text-[11px] font-bold tracking-[0.16em] text-[#7a6a50]">
                TOP ELIGIBLE PRIMARY SCHEME
              </p>
            </div>

            <div className="rounded-2xl border-2 border-[#35536a] bg-white p-7 shadow-[0_14px_40px_rgba(46,75,98,0.1)]">
              <div className="flex flex-col justify-between gap-6 md:flex-row md:items-start">
                <div className="max-w-2xl">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="rounded-full bg-[#e7f3f8] px-3 py-1 text-[10px] font-bold tracking-[0.12em] text-[#1769a8]">
                      {topScheme.scheme_id}
                    </span>
                    <span className="rounded-full bg-[#edf6ec] px-3 py-1 text-[10px] font-bold text-[#47744a]">
                      ELIGIBLE
                    </span>
                    <span className="rounded-full bg-[#eaf5fa] px-3 py-1 text-[10px] font-bold text-[#145c91]">
                      {topSchemeScore}% MATCH
                    </span>
                  </div>

                  <h2 className="mt-4 font-serif text-3xl font-bold text-[#1b3148]">
                    {topScheme.scheme_name}
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-[#6e7f91]">
                    This scheme passed the current backend eligibility
                    filters for your submitted profile.
                  </p>
                </div>

                <div className="rounded-xl bg-[#f7fafc] p-5 md:min-w-[260px]">
                  <p className="text-[11px] font-semibold text-[#7f8c99]">
                    Matching reasons
                  </p>
                  <div className="mt-3 space-y-3">
                    {(topScheme.reasons || []).map((reason) => (
                      <ReasonRow key={reason} text={reason} />
                    ))}
                  </div>
                </div>
              </div>

              {topScheme.gender_status?.message && (
                <div className="mt-6 rounded-xl border border-[#e3d7bf] bg-[#fbf7ee] p-4">
                  <div className="flex gap-3">
                    <Sparkles size={17} className="mt-0.5 shrink-0 text-[#ad8245]" />
                    <p className="text-xs leading-5 text-[#756447]">
                      {topScheme.gender_status.message}
                    </p>
                  </div>
                </div>
              )}

              {/* Action Callout: Submit Application to Author Desk */}
              <div className="mt-7 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-[#e2edf3] pt-6">
                <div>
                  <p className="text-sm font-bold text-[#1f374e]">
                    Ready to proceed with this 95% matched scheme?
                  </p>
                  <p className="text-xs text-[#6e7f91]">
                    Submit your application for immediate scrutiny by the Author & Channel Partner.
                  </p>
                </div>
                <button
                  onClick={() => handleInitiateApply(topScheme)}
                  className="flex items-center justify-center gap-2 rounded-xl bg-[#1769a8] px-6 py-3.5 text-sm font-bold text-white shadow-md transition hover:bg-[#125385] active:scale-[0.98]"
                >
                  <Sparkles size={16} />
                  <span>Submit & Apply for this Scheme</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </section>
        )}


        <section className="mt-10">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <p className="text-[11px] font-bold tracking-[0.16em] text-[#1769a8]">
                PRIMARY RECOMMENDATIONS
              </p>
              <h2 className="mt-1 font-serif text-2xl font-bold text-[#20344b]">
                Eligible PS-Core Schemes
              </h2>
            </div>
            <span className="text-xs font-semibold text-[#7a8998]">
              {primaryMatchCount} eligible
            </span>
          </div>

          {primaryEligible.length === 0 ? (
            <EmptyState
              title="No primary scheme matched"
              text="Your submitted profile did not satisfy the current primary-scheme eligibility rules."
            />
          ) : (
            <div className="mt-5 grid gap-5 md:grid-cols-2">
              {primaryEligible.map((scheme) => (
                <EligibleSchemeCard
                  key={scheme.scheme_id}
                  scheme={scheme}
                  formData={formData}
                  featured={scheme.scheme_id === topScheme?.scheme_id}
                  onApply={(s) => handleInitiateApply(s)}
                />
              ))}
            </div>
          )}
        </section>

        <section className="mt-12">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <p className="text-[11px] font-bold tracking-[0.16em] text-[#7a8998]">
                SECONDARY
              </p>
              <h2 className="mt-1 font-serif text-2xl font-bold text-[#20344b]">
                Related / Connected Support
              </h2>
            </div>
            <span className="text-xs font-semibold text-[#7a8998]">
              {secondaryMatchCount} available
            </span>
          </div>

          {secondaryEligible.length === 0 ? (
            <EmptyState
              title="No secondary support matched"
              text="No connected support programme passed the current filters."
            />
          ) : (
            <div className="mt-5 grid gap-5">
              {secondaryEligible.map((scheme) => (
                <EligibleSchemeCard
                  key={scheme.scheme_id}
                  scheme={scheme}
                  formData={formData}
                  secondary
                />
              ))}
            </div>
          )}
        </section>

        <section className="mt-12">
          <div>
            <p className="text-[11px] font-bold tracking-[0.16em] text-[#8c6e6e]">
              NOT ELIGIBLE
            </p>
            <h2 className="mt-1 font-serif text-2xl font-bold text-[#48343d]">
              Primary schemes that were filtered out
            </h2>
            <p className="mt-2 text-sm text-[#7b8087]">
              These are shown for transparency so the applicant can understand why a scheme was not recommended.
            </p>
          </div>

          {primaryIneligible.length === 0 ? (
            <div className="mt-5 rounded-xl border border-[#dfe9df] bg-white p-5 text-sm text-[#607a60]">
              No primary schemes were filtered out.
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              {primaryIneligible.map((scheme) => (
                <div
                  key={`${scheme.scheme_id}-${scheme.eligibility_status || "ineligible"}`}
                  className="rounded-xl border border-[#eadfe1] bg-white p-5"
                >
                  <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="rounded-full bg-[#f3f0f1] px-3 py-1 text-[10px] font-bold tracking-[0.1em] text-[#7f6d74]">
                          {scheme.scheme_id}
                        </span>
                        <span className="rounded-full bg-[#fff0f0] px-3 py-1 text-[10px] font-bold text-[#a44c4c]">
                          NOT ELIGIBLE
                        </span>
                        {scheme.match_score === 0 &&
                          scheme.eligibility_status === "NOT_ELIGIBLE_GENDER" && (
                            <span className="rounded-full bg-[#fff0f0] px-3 py-1 text-[10px] font-bold text-[#a44c4c]">
                              0% MATCH
                            </span>
                          )}
                      </div>

                      <h3 className="mt-3 font-serif text-xl font-bold text-[#3b3138]">
                        {scheme.scheme_name}
                      </h3>
                    </div>

                    <div className="max-w-[560px] space-y-2">
                      {(scheme.failures || []).length === 0 ? (
                        <div className="text-xs text-[#8a747a]">
                          No detailed failure reason was returned by the backend.
                        </div>
                      ) : (
                        (scheme.failures || []).map((failure, index) => (
                          <div
                            key={`${failure}-${index}`}
                            className="flex gap-2 text-xs leading-5 text-[#915858]"
                          >
                            <AlertCircle size={15} className="mt-0.5 shrink-0" />
                            <span>{failure}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mt-12 rounded-2xl border border-[#d7e2e8] bg-white p-7">
          <div className="flex items-start gap-3">
            <Bot size={21} className="mt-0.5 shrink-0 text-[#1769a8]" />
            <div>
              <h3 className="font-serif text-xl font-bold text-[#263b52]">
                What happens next?
              </h3>
              <p className="mt-2 text-sm leading-6 text-[#6e7f91]">
                The current result is the deterministic eligibility result
                from FastAPI. Eligible schemes can then be ranked, given a
                detailed match score, explained, and connected to documents,
                financial calculations and channel-partner routing.
              </p>
            </div>
          </div>
        </section>

        <div className="mt-8 flex flex-wrap gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-2 rounded-lg border border-[#cfdbe3] bg-white px-5 py-3 text-sm font-semibold text-[#38506a] transition hover:bg-[#f7fafc]"
          >
            <ArrowLeft size={17} />
            Back to Profile
          </button>

          <button
            onClick={onHome}
            className="flex items-center gap-2 rounded-lg bg-[#145c91] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#104d7b]"
          >
            Back to Home
          </button>
        </div>

        <div className="mt-8 text-xs text-[#8a97a3]">
          Submitted profile: {formData.fullName || "Applicant"} • Category:{" "}
          {formData.category || "Not selected"} •{" "}
          {formData.state ? formatValue(formData.state) : "Location not provided"}
        </div>
      </main>

      {/* Application Submission Modal */}
      {applyModalOpen && selectedSchemeToApply && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-[#d6e3ec] overflow-hidden">
            {/* Header */}
            <div className="border-b border-[#e5eff5] bg-[#f8fbfe] px-6 py-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1769a8] text-white shadow-sm">
                  <Sparkles size={20} />
                </div>
                <div>
                  <h3 className="font-serif text-lg font-bold text-[#14283e]">
                    Submit Scheme Application
                  </h3>
                  <p className="text-xs text-[#5a7288]">
                    Selected: <strong className="text-[#1769a8]">{selectedSchemeToApply.scheme_name}</strong>
                  </p>
                </div>
              </div>

              <button
                onClick={() => setApplyModalOpen(false)}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body Form */}
            <div className="p-6 space-y-4">
              {applyError && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700 flex items-center gap-2">
                  <AlertCircle size={16} className="shrink-0" />
                  <span>{applyError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#49637b] mb-1.5">
                  Applicant Full Name
                </label>
                <input
                  type="text"
                  value={applicantNameInput}
                  onChange={(e) => setApplicantNameInput(e.target.value)}
                  placeholder="e.g. Beast"
                  className="w-full rounded-xl border border-[#cbd9e3] bg-[#fbfdfd] px-4 py-2.5 text-sm text-[#14283e] focus:border-[#1769a8] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1769a8]/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#49637b] mb-1.5">
                  Registered Mobile Number <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-sm font-semibold text-gray-400">
                    +91
                  </span>
                  <input
                    type="tel"
                    maxLength={10}
                    value={mobileInput}
                    onChange={(e) => setMobileInput(e.target.value.replace(/\D/g, ""))}
                    placeholder="e.g. 9151541727"
                    className="w-full rounded-xl border border-[#cbd9e3] bg-[#fbfdfd] pl-12 pr-4 py-2.5 text-sm text-[#14283e] font-mono focus:border-[#1769a8] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1769a8]/20"
                  />
                </div>
                <p className="mt-1 text-[11px] text-[#6d8498]">
                  You will use this mobile number to track real-time progress on the Track Application page.
                </p>
              </div>

              <div className="rounded-xl border border-[#e2edf3] bg-[#f6fafc] p-4 text-xs text-[#4f677d] space-y-1.5">
                <div className="flex justify-between">
                  <span>Required Loan Amount:</span>
                  <strong className="text-[#14283e]">{formatCurrency(formData.requiredLoan || 150000)}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Purpose / Trade:</span>
                  <strong className="text-[#14283e]">{formatValue(formData.purpose || "new_business")}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Category & State:</span>
                  <strong className="text-[#14283e]">
                    {formData.category || "SC"} · {formData.state || "Uttar Pradesh"}
                  </strong>
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="border-t border-[#eaf1f6] bg-[#fbfdfe] px-6 py-4 flex items-center justify-end gap-3">
              <button
                onClick={() => setApplyModalOpen(false)}
                className="rounded-xl border border-[#cbd9e3] bg-white px-4 py-2 text-xs font-bold text-[#44607a] hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSubmitApplication}
                disabled={isApplying}
                className="flex items-center gap-2 rounded-xl bg-[#1769a8] px-6 py-2.5 text-xs font-bold text-white shadow-md hover:bg-[#125385] disabled:opacity-50 transition"
              >
                {isApplying ? (
                  <>
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>Submitting Application...</span>
                  </>
                ) : (
                  <>
                    <Send size={14} />
                    <span>Confirm & Submit Application</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

