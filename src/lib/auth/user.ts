import { prisma } from "../db";
import { getSession, setSessionCookie, SessionPayload } from "./session";

const DEFAULT_USER_EMAIL = "runner@vipera.local";
const DEFAULT_USER_NAME = "Alex Rivers";

export async function getCurrentUser(): Promise<SessionPayload> {
  const session = await getSession();
  if (session) {
    return session;
  }

  // Fallback / Auto-provision default athlete in dev/local mode
  try {
    let user = await prisma.user.findUnique({
      where: { email: DEFAULT_USER_EMAIL },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: DEFAULT_USER_EMAIL,
          name: DEFAULT_USER_NAME,
          role: "USER",
          settings: {
            create: {
              unitSystem: "METRIC",
              paceFormat: "MIN_PER_KM",
              autoPause: false,
              gpsAccuracyThreshold: 25.0,
              voiceCues: true,
              soundEffects: true,
              vibration: true,
              screenWakeLock: true,
              mapTheme: "sport-dark",
            },
          },
        },
      });
    }

    const payload: SessionPayload = {
      userId: user.id,
      email: user.email,
      name: user.name,
    };

    // Attempt to set cookie in request context
    try {
      await setSessionCookie(payload);
    } catch {
      // Ignored if called in read-only RSC context
    }

    return payload;
  } catch (err) {
    // If database connection is not established yet, return default offline athlete profile
    return {
      userId: "local-athlete-alex",
      email: DEFAULT_USER_EMAIL,
      name: DEFAULT_USER_NAME,
    };
  }
}
