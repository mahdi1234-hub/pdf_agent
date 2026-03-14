"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Loader2, ChevronLeft, ChevronRight, Check, FileText, User, Settings, Sparkles } from "lucide-react";

const STEPS = [
  { title: "Profile", icon: User, description: "Tell us about yourself" },
  { title: "Workspace", icon: FileText, description: "Set up your workspace" },
  { title: "Preferences", icon: Settings, description: "Customize your experience" },
  { title: "Ready!", icon: Sparkles, description: "You're all set" },
];

export default function OnboardingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);

  const [formData, setFormData] = useState({
    name: "",
    workspaceName: "",
    workspaceDescription: "",
    role: "",
    industry: "",
    teamSize: "",
    notifications: true,
    darkMode: false,
    analyticsConsent: false,
    usageFrequency: [3],
    notificationPreferences: [] as string[],
  });

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login");
    }
  }, [status, router]);

  useEffect(() => {
    async function checkOnboarding() {
      try {
        const res = await fetch("/api/onboarding");
        const data = await res.json();
        if (data.onboarded) {
          router.push("/chat");
        }
      } catch {
        // continue to onboarding
      } finally {
        setCheckingOnboarding(false);
      }
    }
    if (status === "authenticated") {
      checkOnboarding();
    }
  }, [status, router]);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        router.push("/chat");
      }
    } catch (error) {
      console.error("Onboarding error:", error);
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => {
    if (step < STEPS.length - 1) setStep(step + 1);
  };
  const prevStep = () => {
    if (step > 0) setStep(step - 1);
  };

  if (status === "loading" || checkingOnboarding) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const progress = ((step + 1) / STEPS.length) * 100;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="flex items-center gap-4 mb-4">
            {STEPS.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium transition-colors ${
                    i <= step
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {i < step ? <Check className="h-4 w-4" /> : i + 1}
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`hidden sm:block h-px w-8 ${i < step ? "bg-primary" : "bg-muted"}`} />
                )}
              </div>
            ))}
          </div>
          <Progress value={progress} className="mb-4" />
          <CardTitle>{STEPS[step].title}</CardTitle>
          <CardDescription>{STEPS[step].description}</CardDescription>
        </CardHeader>
        <CardContent>
          {step === 0 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  placeholder="Enter your full name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Your Role</Label>
                <Select value={formData.role} onValueChange={(v) => setFormData({ ...formData, role: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select your role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="developer">Developer</SelectItem>
                    <SelectItem value="designer">Designer</SelectItem>
                    <SelectItem value="manager">Project Manager</SelectItem>
                    <SelectItem value="researcher">Researcher</SelectItem>
                    <SelectItem value="student">Student</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="industry">Industry</Label>
                <Select value={formData.industry} onValueChange={(v) => setFormData({ ...formData, industry: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select your industry" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tech">Technology</SelectItem>
                    <SelectItem value="finance">Finance</SelectItem>
                    <SelectItem value="healthcare">Healthcare</SelectItem>
                    <SelectItem value="education">Education</SelectItem>
                    <SelectItem value="legal">Legal</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="workspace">Workspace Name</Label>
                <Input
                  id="workspace"
                  placeholder="My Workspace"
                  value={formData.workspaceName}
                  onChange={(e) => setFormData({ ...formData, workspaceName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="desc">Description</Label>
                <Textarea
                  id="desc"
                  placeholder="Brief description of your workspace"
                  value={formData.workspaceDescription}
                  onChange={(e) => setFormData({ ...formData, workspaceDescription: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Team Size</Label>
                <RadioGroup
                  value={formData.teamSize}
                  onValueChange={(v) => setFormData({ ...formData, teamSize: v })}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="solo" id="solo" />
                    <Label htmlFor="solo">Just me</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="small" id="small" />
                    <Label htmlFor="small">2-10 people</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="medium" id="medium" />
                    <Label htmlFor="medium">11-50 people</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="large" id="large" />
                    <Label htmlFor="large">50+ people</Label>
                  </div>
                </RadioGroup>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Email Notifications</Label>
                  <p className="text-sm text-muted-foreground">Receive email updates</p>
                </div>
                <Switch
                  checked={formData.notifications}
                  onCheckedChange={(v) => setFormData({ ...formData, notifications: v })}
                />
              </div>
              <Separator />
              <div className="space-y-2">
                <Label>Notification Types</Label>
                <ToggleGroup
                  type="multiple"
                  variant="outline"
                  value={formData.notificationPreferences}
                  onValueChange={(v) => setFormData({ ...formData, notificationPreferences: v })}
                  className="flex flex-wrap justify-start gap-2"
                >
                  <ToggleGroupItem value="email">Email</ToggleGroupItem>
                  <ToggleGroupItem value="push">Push</ToggleGroupItem>
                  <ToggleGroupItem value="sms">SMS</ToggleGroupItem>
                </ToggleGroup>
              </div>
              <Separator />
              <div className="space-y-2">
                <Label>Usage Frequency (days/week)</Label>
                <Slider
                  value={formData.usageFrequency}
                  onValueChange={(v) => setFormData({ ...formData, usageFrequency: v })}
                  max={7}
                  min={1}
                  step={1}
                />
                <p className="text-sm text-muted-foreground text-center">{formData.usageFrequency[0]} days per week</p>
              </div>
              <Separator />
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="analytics"
                  checked={formData.analyticsConsent}
                  onCheckedChange={(v) => setFormData({ ...formData, analyticsConsent: v as boolean })}
                />
                <Label htmlFor="analytics" className="text-sm">
                  I agree to anonymous usage analytics to help improve the product
                </Label>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="text-center space-y-4 py-6">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">Welcome, {formData.name || "User"}!</h3>
              <p className="text-muted-foreground">
                Your workspace <span className="font-medium text-foreground">{formData.workspaceName || "Workspace"}</span> is ready.
                Start uploading PDFs and chatting with your AI assistant.
              </p>
            </div>
          )}

          <div className="flex justify-between mt-6">
            <Button
              variant="outline"
              onClick={prevStep}
              disabled={step === 0}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Previous
            </Button>

            {step < STEPS.length - 1 ? (
              <Button onClick={nextStep}>
                Next
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Get Started
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
