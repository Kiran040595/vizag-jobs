import { useEffect, useState } from 'react';
import JoinChannelBeforeApplyModal from './JoinChannelBeforeApplyModal';
import {
  consumeExternalApplyPrompt,
  subscribeExternalApplyPrompt,
} from '../lib/jobGroupLink';

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
    setPrompt(null);
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
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
