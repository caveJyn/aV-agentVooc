import character from "./character";
import knowledge from "./knowledge";
import User from "./user";
import item from "./item";
import webhookError from "./webhookError";
import landingPage from "./landingPage";
import emailTemplate from "./emailTemplate";
import characterPreset from "./characterPreset";
import legalDocuments from "./legalDocuments";
import companyPage from "./companyPage";
import blogPost from "./blogPost";
import pressPost from "./pressPost";
import productPages from "./productPages";
import invoice from "./invoice";
import docs from "./docs";
import table from "./table";
import transaction from "./transaction";
import wallet from "./wallet";
import starknetWallet from "./starknetWallet";

export const schemaTypes = [
  character,
  characterPreset,
  knowledge,
  User,
  item,
  webhookError,
  landingPage,
  emailTemplate,
  legalDocuments,
  companyPage,
  blogPost,
  docs,
  pressPost,
  productPages,
  invoice,
  table,
  transaction,
  wallet,
  starknetWallet
];

export default schemaTypes;
