import React from 'react';

interface VisionClearLogoProps extends React.SVGProps<SVGSVGElement> {}

const VisionClearLogo: React.FC<VisionClearLogoProps> = (props) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 200 60" // Adjusted viewBox for aspect ratio
      {...props}
    >
      {/* Eyebrow Curve */}
      <path
        d="M 50,15 Q 100,5 150,15 Q 125,25 75,25 Z"
        fill="black"
      />

      {/* "Visi" Text */}
      <text
        x="10"
        y="35"
        fontFamily="Arial, sans-serif"
        fontSize="24"
        fontWeight="bold"
        fill="red"
      >
        Visi
      </text>

      {/* Eye Graphic (simplified) */}
      <defs>
        <radialGradient id="eyeGradient" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
          <stop offset="0%" style={{ stopColor: '#00BFFF', stopOpacity: 1 }} /> {/* Deep Sky Blue */}
          <stop offset="70%" style={{ stopColor: '#1E90FF', stopOpacity: 1 }} /> {/* Dodger Blue */}
          <stop offset="100%" style={{ stopColor: '#00008B', stopOpacity: 1 }} /> {/* Dark Blue */}
        </radialGradient>
      </defs>
      <circle cx="100" cy="25" r="15" fill="url(#eyeGradient)" />
      <circle cx="100" cy="25" r="5" fill="black" /> {/* Pupil */}
       <circle cx="103" cy="22" r="1.5" fill="white" fillOpacity="0.8" /> {/* Highlight */}


      {/* "n" Text */}
      <text
        x="120" // Adjusted position
        y="35"
        fontFamily="Arial, sans-serif"
        fontSize="24"
        fontWeight="bold"
        fill="red"
      >
        n
      </text>

      {/* "CLEAR OPTICALS" Text */}
      <text
        x="35" // Adjusted position
        y="55"
        fontFamily="Arial, sans-serif"
        fontSize="14"
        fontWeight="normal"
        fill="black" // Using black for better visibility than gray
      >
        CLEAR OPTICALS
      </text>
    </svg>
  );
};

export default VisionClearLogo;
