import React, { Component } from "react";
import "./styles.css";

interface LabelInfo {
  title: string;
  value: string | number | boolean;
  desc?: string;
}

export type TogglePosition = "left" | "right" | "center"

interface Labels {
  left: LabelInfo;
  center: LabelInfo;
  right: LabelInfo;
}

interface TripleToggleSwitchProps {
  labels?: Labels;
  onChange?: (value: TogglePosition | undefined) => void;
  styles?: React.CSSProperties;
  activePosition: "left" | "center" | "right";
}

interface TripleToggleSwitchState {
  switchPosition: "left" | "center" | "right";
  animation: string | null;
}

class TripleToggleSwitch extends Component<TripleToggleSwitchProps, TripleToggleSwitchState> {
  static defaultProps: Partial<TripleToggleSwitchProps> = {
    labels: {
      left: { title: "left", value: "left", desc: "Left description" },
      center: { title: "center", value: "center", desc: "Center description" },
      right: { title: "right", value: "right", desc: "Right description" },
    },
    onChange: (value) => console.log("value:", value),
    activePosition: "center",
  };

  constructor(props: TripleToggleSwitchProps) {
    super(props);
    console.log("in constructor props.activePosition: " + props.activePosition)
    this.state = {
      switchPosition: props.activePosition,
      animation: null,
    };
  }


  componentDidUpdate(prevProps: TripleToggleSwitchProps) {
    if (prevProps.activePosition !== this.props.activePosition) {
      this.setState({ switchPosition: this.props.activePosition || "center" });
    }
  }
  
  getSwitchAnimation = (value: "left" | "center" | "right") => {
    const { switchPosition } = this.state;
    let animation: string | null = null;

    const transitions: Record<string, string> = {
      "left-center": "left-to-center",
      "center-right": "center-to-right",
      "right-center": "right-to-center",
      "center-left": "center-to-left",
      "right-left": "right-to-left",
      "left-right": "left-to-right",
    };

    animation = transitions[`${switchPosition}-${value}`] || null;
    this.props.onChange?.(value);
    this.setState({ switchPosition: value, animation });
  };

  render() {
    const { labels } = this.props;
    const { switchPosition, animation } = this.state;

    console.log("switchPosition: " + switchPosition)
    console.log("props.activePosition" + this.props.activePosition)

    return (
        <div>
      <div className="main-container" style={{ position: "relative", display: "inline-block" }}>
        <div className={`switch ${animation} ${switchPosition}-position`}></div>

        {["left", "center", "right"].map((position) => (
          <React.Fragment key={position}>
            <input
              onChange={() => this.getSwitchAnimation(position as "left" | "center" | "right")}
              name="map-switch"
              id={position}
              type="radio"
              value={position}
              checked={switchPosition === position}
            />
            <label
              className={`${position}-label ${switchPosition === position ? "black-font" : ""}`}
              htmlFor={position}
            >
              <h4>{labels?.[position as keyof Labels]?.title}</h4>
            </label>
          </React.Fragment>
        ))}

      </div>
              <p className="toggle-description">
              {labels?.[switchPosition]?.desc}
            </p>
            </div>
    );
  }
}

export default TripleToggleSwitch;
