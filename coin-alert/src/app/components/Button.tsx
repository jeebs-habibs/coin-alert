'use client'

import React, { CSSProperties } from "react";
import "./buttonStyles.css";

interface ButtonProps {
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger" | "grey";
  onClick?: () => void;
  style?: CSSProperties
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  size = "md",
  disabled = false,
  style,
  variant = "primary",
  onClick,
  children,
}) => {
  return (
    <button
      className={`button ${size} ${variant} ${disabled ? "disabled" : ""}`}
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
      style={style}
    >
      {children}
    </button>
  );
};
