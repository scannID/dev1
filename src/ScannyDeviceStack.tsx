import { ScannyPhoneDemo } from './ScannyPhoneDemo'
import { ScannyTabletDemo } from './ScannyTabletDemo'

/** Hero composition: merchant tablet with customer iPhone overlapping on top. */
export function ScannyDeviceStack() {
  return (
    <div
      className="scanny-device-stack"
      style={{
        position: 'relative',
        width: 'min(900px, 100%)',
        minHeight: 640,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
      }}
    >
      <style>{`
        @keyframes scannyPhoneDrift {
          0%   { transform: rotate(4deg) scale(0.78) translateX(-56px); }
          50%  { transform: rotate(4deg) scale(0.78) translateX(48px); }
          100% { transform: rotate(4deg) scale(0.78) translateX(-56px); }
        }
        @keyframes scannyPhoneDriftMobile {
          0%   { transform: rotate(3deg) scale(0.62) translateX(-36px); }
          50%  { transform: rotate(3deg) scale(0.62) translateX(28px); }
          100% { transform: rotate(3deg) scale(0.62) translateX(-36px); }
        }
        .scanny-device-stack .scanny-tablet {
          transform: rotate(-1.5deg);
          transform-origin: center center;
        }
        .scanny-device-stack .scanny-phone-layer {
          position: absolute;
          right: -16px;
          bottom: -48px;
          z-index: 3;
          transform-origin: bottom right;
          pointer-events: none;
          animation: scannyPhoneDrift 6s ease-in-out infinite;
          will-change: transform;
        }
        .scanny-device-stack .scanny-phone-layer > div {
          margin-left: 0 !important;
          justify-content: center !important;
        }
        .scanny-device-stack .scanny-phone-layer > div > div {
          margin-left: 0 !important;
        }
        @media (max-width: 768px) {
          .scanny-device-stack {
            min-height: 460px;
            justify-content: center;
          }
          .scanny-device-stack .scanny-tablet {
            width: min(640px, 94vw) !important;
            transform: none;
          }
          .scanny-device-stack .scanny-phone-layer {
            right: 2%;
            bottom: -28px;
            animation: scannyPhoneDriftMobile 6s ease-in-out infinite;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .scanny-device-stack .scanny-phone-layer {
            animation: none;
            transform: rotate(4deg) scale(0.78);
          }
        }
      `}</style>

      <ScannyTabletDemo />

      <div className="scanny-phone-layer" aria-hidden={false}>
        <ScannyPhoneDemo />
      </div>
    </div>
  )
}
