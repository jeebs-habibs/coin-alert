import React, { useState } from 'react';
import './ToggleDescription.css';

// Type definitions (updated to include desc)
interface LabelInfo {
  desc?: string;
  alarmInfo?: string[];
}

interface Props {
  labelInfo: LabelInfo | undefined;
}

const ToggleDescription: React.FC<Props> = ({ labelInfo }) => {
  const [showRules, setShowRules] = useState(false);

  const toggleRules = () => {
    setShowRules((prev) => !prev);
  };

  return (
    <div className="toggle-description-container">
      {labelInfo?.desc && <p className="toggle-description">{labelInfo.desc}</p>}
      <button
        className="toggle-rules-button"
        onClick={toggleRules}
        aria-expanded={showRules}
        aria-controls="alarm-rules"
      >
        <span>{showRules ? 'Hide Alarm Rules' : 'Show Alarm Rules'}</span>
        <svg
          className={`chevron-icon ${showRules ? 'rotated' : ''}`}
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M4 6 L8 10 L12 6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <div
        id="alarm-rules"
        className={`alarm-rules-card ${showRules ? 'visible' : ''}`}
      >
        {labelInfo?.alarmInfo?.map((alarmRule: string) => (
          <p key={alarmRule.replace(' ', '-')} className="alarm-rule">
            {alarmRule}
          </p>
        ))}
      </div>
    </div>
  );
};

export default ToggleDescription;