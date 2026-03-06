import { kickstarterDocs } from './kickstarter-docs';
import { advancedKickstarterDocs } from './kickstarter-docs-advanced';

const mergedDocs = { ...kickstarterDocs, ...advancedKickstarterDocs };
export { mergedDocs as kickstarterDocs };
