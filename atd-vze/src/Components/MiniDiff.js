import React from "react";

export const MiniDiff = ({ oldText, newText }) => {
  let output = [];

  console.log("MeeniDeef");

  newText.split("").forEach((currentChar, i) => {
    output.push(
      <span
        className={
          "minidiff" +
          (currentChar !== oldText.charAt(i) ? " minidiff--highlight" : "")
        }
      >
        {currentChar}
      </span>
    );
  });

  return output;
};
