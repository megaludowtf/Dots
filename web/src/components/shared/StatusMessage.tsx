interface Props {
  text: string;
  tone?: 'ok' | 'err' | '';
}

export function StatusMessage({ text, tone = '' }: Props) {
  return <div className={`status ${tone}`.trim()}>{text}</div>;
}
