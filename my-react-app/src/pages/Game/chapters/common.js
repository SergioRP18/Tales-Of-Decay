export const applyTokens = (text, ctx) => {
    if (!text) return text;
    const hoarderName = ctx?.hoarder?.username ?? "el acaparador";
    return text.replaceAll("{hoarder}", hoarderName);
  };
  
  export const prepareDefault = async () => ({});
  
  export const getPreContentDefault = ({ chapter }) => ({
    title: chapter?.title,
    message:
      'Antes de oprimir "Listo", leer la carta del capítulo correspondiente y asegurarse de que todos entiendan.',
  });
  
  export const onVoteResolvedDefault = async ({ winningOption, chapter }) => {
    const opt = chapter?.voteOptions?.find(o => o.id === winningOption);
    return {
      announcements: [],
      eliminated: [],
      saved: [],
      feedbackText: opt?.feedback ?? (opt?.text ? `El grupo decidió: ${opt.text}.` : null),
    };
  };
  