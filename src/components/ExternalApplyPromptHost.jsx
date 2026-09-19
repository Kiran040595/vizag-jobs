import { useEffect, useState } from 'react';
import JoinChannelBeforeApplyModal from './JoinChannelBeforeApplyModal';
import {
  consumeExternalApplyPrompt,
  subscribeExternalApplyPrompt,
} from '../lib/jobGroupLink';
import { recordAndOpenExternalApply } from '../services/jobApplyClicks';

/**
 * Global listener for external-apply prompts (login redirect, apply button, etc.).
 */
export default function ExternalApplyPromptHost() {
  const [prompt, setPrompt] = useState(null);

  const readPrompt = () => {
    const next = consumeExternalApplyPrompt();
    if (next) {
      setPrompt(next);
    }
  };

  useEffect(() => {
    readPrompt();
    return subscribeExternalApplyPrompt(readPrompt);
  }, []);

  if (!prompt) {
    return null;
  }

  const continueApply = () => {
    const url = prompt.applyUrl;
    const jobId = prompt.jobId;
    setPrompt(null);
    recordAndOpenExternalApply(url, jobId);
  };

  return (
    <JoinChannelBeforeApplyModal
      channelUrl={prompt.channelUrl}
      jobTitle={prompt.jobTitle}
      onContinue={continueApply}
      onClose={() => setPrompt(null)}
    />
  );
}
