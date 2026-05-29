type PageHeaderProps = {
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
};

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-3 mb-7 md:flex-row md:items-start md:justify-between md:gap-4">
      <div className="min-w-0">
        <h1 className="font-display text-2xl md:text-3xl font-semibold text-ink">
          {title}
        </h1>
        {subtitle && (
          <p className="font-body text-sm text-mute mt-1">{subtitle}</p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      )}
    </header>
  );
}
