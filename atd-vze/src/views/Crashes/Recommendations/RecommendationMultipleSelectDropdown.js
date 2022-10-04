import React, { useState } from "react";
import Multiselect from "multiselect-react-dropdown";
import "../crash.scss";

const RecommendationMultipleSelectDropdown = ({
  options,
  onOptionClick,
  partners,
  fieldConfig,
  field,
}) => {
  const handleOptionClick = (selectedList, selectedItem) => {
    const valuesObject = { [field]: parseInt(selectedItem.id) };
    onOptionClick(valuesObject);
  };
  // Add a null option to enable users to clear out the value
  const makeOptionsWithNullOption = options => [
    { id: null, description: "None" },
    ...options,
  ];

  console.log(options);

  const getSelectedValues = ({ lookupOptions, key }) => {
    return partners.map(partner => partner?.[lookupOptions] || "");
  };

  const customStyles = {
    control: () => ({
      border: "none",
    }),
  };

  return (
    <Multiselect
      options={makeOptionsWithNullOption(options)}
      displayValue={"description"}
      showCheckbox
      selectedValues={
        partners ? getSelectedValues(fieldConfig.fields.partner_id) : null
      }
      showArrow
      hideSelectedList
      placeholder={
        partners
          ? getSelectedValues(fieldConfig.fields.partner_id)
              .map(partner => partner.description)
              .join(",  ")
          : null
      }
      id="css_custom"
      style={{
        searchBox: {
          border: "none",
        },
      }}
      onSelect={(selectedList, selectedItem) =>
        handleOptionClick(selectedList, selectedItem)
      }
      closeOnSelect={false}
    ></Multiselect>
  );
};

export default RecommendationMultipleSelectDropdown;
