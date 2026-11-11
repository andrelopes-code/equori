// The outcome of a command of the data section, shown in one notice below its rows.
export interface DataMessage {
  tone: "success" | "danger";
  text: string;
}
