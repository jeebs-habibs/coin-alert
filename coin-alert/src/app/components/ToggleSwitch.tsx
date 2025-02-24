import { useEffect, useState } from "react";
import "./ToggleSwitch.css"; // Import external CSS

interface ToggleSwitchProps {
  label?: string; // Static text on the left
  isOn: boolean; // External state that may change
  onToggle: (newState: boolean) => void; // Function to call when toggled
}

export default function ToggleSwitch({ label, isOn, onToggle }: ToggleSwitchProps) {
  const [toggleState, setToggleState] = useState(isOn);

  // 🔹 Update local state when `isOn` prop changes externally
  useEffect(() => {
    setToggleState(isOn);
  }, [isOn]);

  const handleToggle = () => {
    const newState = !toggleState;
    setToggleState(newState);
    onToggle(newState); // Call parent function
  };

  return (
    <div className="toggle-container">
      <span className="toggle-label">{label}</span>
      <button className={`toggle-switch ${toggleState ? "on" : "off"}`} onClick={handleToggle}>
        <div className="toggle-slider" />
      </button>
    </div>
  );
}
