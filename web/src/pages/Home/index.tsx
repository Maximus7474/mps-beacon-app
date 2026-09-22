import { useState, useMemo } from 'react';
import { formatRelativeTime } from '~/utils/utils';
import type { Company } from '@common/types';
import { BrandMark } from '~/components/BrandMark';
import styles from './index.module.scss';
import { CaretRightIcon, MagnifyingGlassIcon } from '@phosphor-icons/react/dist/ssr';

interface HomePageProps {
  companies: Company[];
  onSelectCompany: (company: Company) => void;
}

export function HomePage({ companies, onSelectCompany }: HomePageProps) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return [...companies].sort((a, b) => a.lastActiveMinutes - b.lastActiveMinutes);
    return companies
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) || c.category.toLowerCase().includes(q) || c.tags.some((t) => t.includes(q)),
      )
      .sort((a, b) => a.lastActiveMinutes - b.lastActiveMinutes);
  }, [query, companies]);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <div>
            <h1 className={styles.title}>Nearby</h1>
          </div>
        </div>
        <div className={styles.searchWrap}>
          <MagnifyingGlassIcon className={styles.searchIcon} />
          <input
            className={styles.searchInput}
            type='search'
            placeholder='Search businesses...'
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className={styles.list}>
        {filtered.length > 0 ? (
          <>
            <div className={styles.sectionHeader}>
              {query ? `${filtered.length} result${filtered.length !== 1 ? 's' : ''}` : 'Recently Active'}
            </div>
            {filtered.map((company) => (
              <CompanyCard key={company.id} company={company} onClick={() => onSelectCompany(company)} />
            ))}
          </>
        ) : (
          <div className={styles.empty}>No businesses found for "{query}"</div>
        )}
      </div>
    </div>
  );
}

function CompanyCard({ company, onClick }: { company: Company; onClick: () => void }) {
  return (
    <div className={styles.card} onClick={onClick} role='button' tabIndex={0}>
      <div className={styles.cardInner}>
        <BrandMark image={company.image} icon={company.icon} iconBg={company.iconBg} className={styles.logo} />
        <div className={styles.info}>
          <div className={styles.nameRow}>
            <span className={styles.name}>{company.name}</span>
          </div>
          <div className={styles.category}>{company.category}</div>
          <div className={styles.metaRow}>
            <span className={`${styles.statusBadge} ${styles[company.status]}`}>
              {company.status === 'open' ? 'Open' : company.status === 'busy' ? 'Busy' : 'Closed'}
            </span>
            <span className={styles.lastActive}>{formatRelativeTime(company.lastActiveMinutes)}</span>
          </div>
        </div>
        <CaretRightIcon className={styles.chevron} size="1rem" />
      </div>
    </div>
  );
}
