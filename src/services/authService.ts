import { CookieOptions, Response, NextFunction } from 'express';
import { IReCaptchaResponse } from '@base/types/recaptchaResponse';
import User from '@models/userModel';
import IUser from '@base/types/user';
import crypto from 'crypto';
import sendEmail from '@utils/email';
import {
  formConfirmationMessage,
  formConfirmationMessageHtml,
  formResetPasswordMessage,
  formResetPasswordMessageHtml,
} from '@utils/emailMessages';
import AppError from '@errors/AppError';
import axios from 'axios';

export const validateBeforeLogin = async (
  email: string,
  password: string
): Promise<string> => {
  if (!email || !password) return 'missing email or password';

  const user = await User.findOne({ email }).select('+password');
  if (user && user.accountStatus === 'unverified')
    return 'please verify your email first to be able to login';
  if (user && !(await user.isCorrectPassword(password)))
    return 'wrong email or password';

  return 'validated';
};

export const generateUsername = async (): Promise<string> => {
  let username: string;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    username = btoa(Math.random().toString(36).substring(2, 17));
    username = username.replace(/[^a-zA-Z0-9]/g, '');
    // eslint-disable-next-line no-await-in-loop
    const user = await User.findOne({ username });
    if (!user) return username;
  }
};

export const storeCookie = (
  res: Response,
  COOKIE_EXPIRES_IN: string,
  token: string,
  cookieName: string
): void => {
  const cookieOptions: CookieOptions = {
    expires: new Date(Date.now() + Number(COOKIE_EXPIRES_IN) * 60 * 60 * 1000),
    httpOnly: true,
    secure: false,
  };

  if (process.env.NODE_ENV === 'production') {
    cookieOptions.secure = true;
  }
  res.cookie(cookieName, token, cookieOptions);
};

export const verifyReCaptcha = async (
  recaptchaResponse: string
): Promise<IReCaptchaResponse> => {
  if (!recaptchaResponse)
    return { message: 'please validate the recaptcha', response: 400 };

  const verificationURL: string = `https://www.google.com/recaptcha/api/siteverify?secret=${process.env.RECAPTCHA_SECRET}&response=${recaptchaResponse}`;
  const verificationResponse = await axios.post(verificationURL);
  const verificationResponseData = verificationResponse.data;

  if (!verificationResponseData.success)
    return { message: 'reCaptcha verification failed', response: 400 };
  return { message: 'recaptcha is verified', response: 200 };
};

export const isCorrectVerificationCode = async (
  user: IUser,
  verificationCode: string
): Promise<boolean> => {
  const hashedCode = crypto
    .createHash('sha256')
    .update(verificationCode)
    .digest('hex');
  console.log(user.emailVerificationCode, hashedCode);
  if (
    hashedCode !== user.emailVerificationCode ||
    (user.emailVerificationCodeExpires &&
      Date.now() > user.emailVerificationCodeExpires)
  )
    return false;
  return true;
};

export const sendConfirmationCodeEmail = async (
  user: IUser,
  verificationCode: string
) => {
  const { email } = user;
  const message: string = formConfirmationMessage(email, verificationCode);
  const htmlMessage: string = formConfirmationMessageHtml(
    email,
    verificationCode
  );
  await sendEmail({
    email,
    subject: 'Verify your Email Address for Telware',
    message,
    htmlMessage,
  });
};

export const sendEmailVerificationCode = async (
  user: IUser | undefined,
  next: NextFunction,
  errorState: any
) => {
  if (!user)
    return next(
      new AppError(
        'Please register first to be able to verify your email!',
        400
      )
    );

  if (user.accountStatus !== 'unverified')
    return next(new AppError('Your account is already verified!', 400));

  if (
    user.emailVerificationCodeExpires &&
    Date.now() < user.emailVerificationCodeExpires
  )
    return next(
      new AppError(
        'A verification email is already sent, you can ask for another after this one expires',
        400
      )
    );
  const verificationCode = user.generateSaveConfirmationCode();
  await user.save({ validateBeforeSave: false });
  await sendConfirmationCodeEmail(user, verificationCode);
  errorState.errorCaught = false;
};

export const sendResetPasswordEmail = async (
  resetURL: string,
  email: string
) => {
  const message: string = formResetPasswordMessage(email, resetURL);
  const htmlMessage: string = formResetPasswordMessageHtml(email, resetURL);
  await sendEmail({
    email,
    subject: 'Reset your Password for Telware',
    message,
    htmlMessage,
  });
};

export const createOAuthUser = async (
  profile: any,
  email?: string
): Promise<any> => {
  const user = await User.findOne({ providerId: profile.id });
  if (user) return user;

  if (!email) {
    email = profile.emails ? profile.emails[0].value : undefined;
  }
  const photo = profile.photos ? profile.photos[0].value : undefined;
  const username = await generateUsername();

  const newUser: IUser = new User({
    provider: profile.provider,
    providerId: profile.id,
    screenName: profile.displayName,
    accountStatus: 'active',
    email,
    photo,
    username,
  });
  await newUser.save({ validateBeforeSave: false });
  return newUser;
};
