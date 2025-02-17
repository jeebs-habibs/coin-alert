'use client'

import React from "react";
import "./buttonStyles.css";

interface ButtonProps {
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger" | "grey";
  onClick?: () => void;
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  size = "md",
  disabled = false,
  variant = "primary",
  onClick,
  children,
}) => {
  return (
    <button
      className={`button ${size} ${variant} ${disabled ? "disabled" : ""}`}
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
    >
      {children}
    </button>
  );
};
