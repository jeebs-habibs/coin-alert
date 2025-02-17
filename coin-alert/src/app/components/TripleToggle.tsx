import React, { Component } from "react";
import "./styles.css";

interface LabelInfo {
  title: string;
  value: string | number | boolean;
  desc?: string;
}

interface Labels {
  left: LabelInfo;
  center: LabelInfo;
  right: LabelInfo;
}

interface TripleToggleSwitchProps {
  labels?: Labels;
  onChange?: (value: string) => void;
  styles?: React.CSSProperties;
}

interface TripleToggleSwitchState {
  switchPosition: "left" | "center" | "right";
  animation: string | null;
  showDescription: boolean[];
}

class TripleToggleSwitch extends Component<TripleToggleSwitchProps, TripleToggleSwitchState> {
  static defaultProps: Partial<TripleToggleSwitchProps> = {
    labels: {
      left: { title: "left", value: "left" },
      center: { title: "center", value: "center" },
      right: { title: "right", value: "right" },
    },
    onChange: (value) => console.log("value:", value),
  };

  constructor(props: TripleToggleSwitchProps) {
    super(props);
    this.state = {
      switchPosition: "left",
      animation: null,
      showDescription: [false, false, false],
    };
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

  handleMouseEnter = (index: number) => {
    this.setState((prevState) => {
      const newShowDescription = [...prevState.showDescription];
      newShowDescription[index] = true;
      return { showDescription: newShowDescription };
    });
  };

  handleMouseLeave = (index: number) => {
    this.setState((prevState) => {
      const newShowDescription = [...prevState.showDescription];
      newShowDescription[index] = false;
      return { showDescription: newShowDescription };
    });
  };

  render() {
    const { labels } = this.props;
    const { showDescription, switchPosition, animation } = this.state;

    return (
      <div className="main-container">
        <div className={`switch ${animation} ${switchPosition}-position`}></div>

        {["left", "center", "right"].map((position, index) => (
          <React.Fragment key={position}>
            <input
              onChange={() => this.getSwitchAnimation(position as "left" | "center" | "right")}
              name="map-switch"
              id={position}
              type="radio"
              value={position}
              defaultChecked={position === "left"}
            />
            <label
              className={`${position}-label ${switchPosition === position ? "black-font" : ""}`}
              htmlFor={position}
              onMouseEnter={() => this.handleMouseEnter(index)}
              onMouseLeave={() => this.handleMouseLeave(index)}
            >
              <h4>{labels?.[position as keyof Labels]?.title}</h4>
              {showDescription[index] && labels?.[position as keyof Labels]?.desc && (
                <div className="showDecription">{labels[position as keyof Labels]?.desc}</div>
              )}
            </label>
          </React.Fragment>
        ))}
      </div>
    );
  }
}

export default TripleToggleSwitch;
