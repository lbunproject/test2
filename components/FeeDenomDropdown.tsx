// FeeDenominationDropdown.tsx
import React, { useState } from 'react';

interface FeeDenominationDropdownProps {
  onChange: (value: string) => void;
}

const FeeDenominationDropdown: React.FC<FeeDenominationDropdownProps> = ({ onChange}) => {
  const [feeSelected, setFeeSelected] = useState(''); 


  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedValue = event.target.value;
    setFeeSelected(selectedValue);
    onChange(selectedValue);
  };

  return (
    <div className="flex items-center justify-center space-x-5 mt-2">
      <label htmlFor="fee-denomination" className="block text-sm font-medium text-white/75">
        Fee
      </label>
      <select
        id="fee-denomination"
        value={feeSelected}
        onChange={handleChange}
        className="w-32 border bg-firefly rounded-lg border-white/10 focus:ring focus:ring-primary ring-offset-firefly px-4 py-2.5 text-white"
      >
        <option value=""></option>
        <option value="FROG">10 FROG</option>
        <option value="BASE">2 BASE</option>
      </select>
    </div>
  );
};

export default FeeDenominationDropdown;