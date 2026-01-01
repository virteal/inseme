import React, { useState } from "react";

export const Card = ({ children, className = "" }) => (
  <div
    className={`rounded-xl border border-white/10 bg-slate-900/50 shadow-sm ${className}`}
  >
    {children}
  </div>
);

export const Button = ({
  children,
  className = "",
  variant = "default",
  size = "default",
  ...props
}) => {
  const baseStyles =
    "inline-flex items-center justify-center rounded-lg font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 cursor-pointer";
  const variants = {
    default: "bg-slate-100 text-slate-900 hover:bg-slate-100/90",
    outline: "border border-white/10 bg-transparent hover:bg-white/5",
    ghost: "hover:bg-white/5",
  };
  const sizes = {
    default: "h-10 px-4 py-2",
    sm: "h-8 px-3 text-xs",
    lg: "h-12 px-8",
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant] || variants.default} ${sizes[size] || sizes.default} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

export const Badge = ({ children, className = "", variant = "default" }) => {
  const variants = {
    default: "bg-slate-100 text-slate-900",
    outline: "text-slate-100 border border-white/10",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors ${variants[variant] || variants.default} ${className}`}
    >
      {children}
    </span>
  );
};

export const Progress = ({ value = 0, className = "" }) => (
  <div
    className={`relative h-2 w-full overflow-hidden rounded-full bg-slate-800 ${className}`}
  >
    <div
      className="h-full w-full flex-1 bg-amber-500 transition-all"
      style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
    />
  </div>
);

export const Avatar = ({ className = "", fallback = "U", src }) => (
  <div
    className={`relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full bg-slate-800 ${className}`}
  >
    {src ? (
      <img src={src} className="aspect-square h-full w-full" alt="Avatar" />
    ) : (
      <div className="flex h-full w-full items-center justify-center rounded-full bg-slate-700 text-xs font-medium">
        {fallback}
      </div>
    )}
  </div>
);

export const Tabs = ({
  defaultValue,
  children,
  className = "",
  onValueChange,
}) => {
  const [activeTab, setActiveTab] = useState(defaultValue);

  const handleValueChange = (value) => {
    setActiveTab(value);
    if (onValueChange) onValueChange(value);
  };

  return (
    <div className={className}>
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child, {
            activeTab,
            onValueChange: handleValueChange,
          });
        }
        return child;
      })}
    </div>
  );
};

export const TabsList = ({
  children,
  className = "",
  activeTab,
  onValueChange,
}) => (
  <div
    className={`inline-flex h-10 items-center justify-center rounded-md bg-slate-900/50 p-1 text-slate-400 ${className}`}
  >
    {React.Children.map(children, (child) => {
      if (React.isValidElement(child)) {
        return React.cloneElement(child, { activeTab, onValueChange });
      }
      return child;
    })}
  </div>
);

export const TabsTrigger = ({
  value,
  children,
  className = "",
  activeTab,
  onValueChange,
}) => (
  <button
    onClick={() => onValueChange(value)}
    data-state={activeTab === value ? "active" : "inactive"}
    className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 cursor-pointer ${
      activeTab === value
        ? "bg-amber-500 text-slate-950 shadow-sm"
        : "hover:text-slate-200"
    } ${className}`}
  >
    {children}
  </button>
);

export const TabsContent = ({ value, children, className = "", activeTab }) => {
  if (activeTab !== value) return null;
  return (
    <div
      data-state={activeTab === value ? "active" : "inactive"}
      className={`mt-2 ring-offset-background focus-visible:outline-none ${className}`}
    >
      {children}
    </div>
  );
};
