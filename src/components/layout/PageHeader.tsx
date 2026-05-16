type PageHeaderProps = {
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
};

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <header className="flex items-start justify-between mb-7">
      <div>
        <h1 className="font-display text-3xl font-semibold text-ink">
          {title}
        </h1>
        {subtitle && (
          <p className="font-body text-sm text-mute mt-1">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}
