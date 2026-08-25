import React from "react"

import { IconProps } from "@/types/icon"

const Grid: React.FC<IconProps> = ({
  size = "16",
  color = "currentColor",
  ...attributes
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...attributes}
    >
      <rect x="2.5" y="2.5" width="6" height="6" rx="1" fill={color} />
      <rect x="11.5" y="2.5" width="6" height="6" rx="1" fill={color} />
      <rect x="2.5" y="11.5" width="6" height="6" rx="1" fill={color} />
      <rect x="11.5" y="11.5" width="6" height="6" rx="1" fill={color} />
    </svg>
  )
}

export default Grid
