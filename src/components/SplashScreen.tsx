import React from 'react';
import { motion } from 'motion/react';

interface SplashScreenProps {
  onEnter: () => void;
}

const MysticGeometry = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 420 420"
    className="pointer-events-none absolute left-1/2 top-1/2 h-[min(82vw,420px)] w-[min(82vw,420px)] -translate-x-1/2 -translate-y-1/2"
    fill="none"
  >
    <g stroke="#7CA982" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.2" opacity="0.1">
      <circle cx="210" cy="210" r="132" />
      <circle cx="210" cy="210" r="84" />
      <path d="M210 62v296M62 210h296" />
      <path d="M105.3 105.3 314.7 314.7M314.7 105.3 105.3 314.7" />
      <path d="m210 88 32 89 90 33-90 32-32 90-33-90-89-32 89-33 33-89Z" />
      <path d="M210 128c40 34 61 61 82 82-21 21-42 48-82 82-40-34-61-61-82-82 21-21 42-48 82-82Z" />
    </g>
  </svg>
);

export const SplashScreen: React.FC<SplashScreenProps> = ({ onEnter }) => {
  return (
    <main className="relative flex min-h-[100dvh] overflow-hidden bg-[#FDF8F0] px-6 py-10 text-center font-sans text-[#3E3A36]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,rgba(232,165,152,0.14),transparent_32%),radial-gradient(circle_at_50%_68%,rgba(124,169,130,0.10),transparent_35%)]" />
      <MysticGeometry />

      <motion.section
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="relative z-10 mx-auto flex min-h-[calc(100dvh-5rem)] w-full max-w-xl flex-col items-center justify-center"
      >
        <div className="relative flex flex-col items-center">
          <motion.img
            src="/app-icon-192.png"
            alt=""
            aria-hidden="true"
            draggable={false}
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 0.82, scale: 1 }}
            transition={{ delay: 0.1, duration: 0.45, ease: 'easeOut' }}
            className="mb-6 h-16 w-16 rounded-[1.25rem] shadow-sm"
          />

          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18, duration: 0.48, ease: 'easeOut' }}
            className="font-serif text-[2.75rem] font-bold leading-tight tracking-[0.16em] text-[#3E3A36] sm:text-6xl"
            style={{ fontFamily: '"Source Han Serif SC", "Noto Serif SC", "Songti SC", serif' }}
          >
            塔罗研习阁
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.28, duration: 0.42, ease: 'easeOut' }}
            className="mt-4 text-base font-medium tracking-[0.16em] text-[#7CA982] sm:text-lg"
          >
            你的塔罗，自有体系。
          </motion.p>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.34, duration: 0.42, ease: 'easeOut' }}
            className="mt-3 text-[13px] font-medium leading-relaxed tracking-[0.18em] text-[#8B857D] sm:text-sm"
          >
            记录·注疏·布阵，构建你的个人手札。
          </motion.p>

          <motion.button
            type="button"
            onClick={onEnter}
            whileHover={{ scale: 1.035, y: -1, backgroundColor: '#ECB0A5' }}
            whileTap={{ scale: 0.96, y: 0 }}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.42, duration: 0.42, ease: 'easeOut' }}
            className="mt-10 inline-flex min-h-12 min-w-40 items-center justify-center rounded-[40px] bg-[#E8A598] px-8 py-3 text-sm font-bold tracking-[0.18em] text-white shadow-sm transition-shadow focus:outline-none focus:ring-2 focus:ring-[#E8A598]/45 focus:ring-offset-4 focus:ring-offset-[#FDF8F0] hover:shadow-md sm:min-h-[52px] sm:min-w-44"
          >
            开启研习
          </motion.button>

          <p className="absolute left-1/2 top-full mt-5 w-[min(84vw,32rem)] -translate-x-1/2 text-center text-[11px] leading-relaxed tracking-[0.12em] text-[#8B857D]/80">
            不教塔罗，只陪你成为自己的塔罗师。
          </p>
        </div>
      </motion.section>
    </main>
  );
};
