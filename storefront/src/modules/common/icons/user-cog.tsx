import React from "react"

import { IconProps } from "@/types/icon"

const UserCog: React.FC<IconProps> = ({
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
      <path
        d="M11.917 16.25v-1.083a2.417 2.417 0 0 0-2.417-2.417H4.833a2.417 2.417 0 0 0-2.416 2.417v1.083"
        stroke={color}
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7.417 9.917a2.417 2.417 0 1 0 0-4.834 2.417 2.417 0 0 0 0 4.834Z"
        stroke={color}
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx="14.583"
        cy="14.583"
        r="1.417"
        stroke={color}
        strokeWidth="1.2"
      />
      <path
        d="M14.583 11.75v.583M14.583 17.417V18M17.417 14.583h-.584M12.333 14.583h-.583M16.481 12.686l-.412.412M12.898 16.269l-.412.412M16.481 16.481l-.412-.412M12.898 12.898l-.412-.412"
        stroke={color}
        strokeWidth="1"
        strokeLinecap="round"
      />
    </svg>
  )
}

export default UserCog
