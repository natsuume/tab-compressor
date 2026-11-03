import type { ChangeEvent } from 'react';
import { DB_FLOOR } from '@/shared/constants';
import { MIXER_OFFSET_RANGE } from '@/shared/tab-mixer';
import { formatSignedDb } from '../format-db';
import type { MeterValues } from '../hooks/useMeterStream';
import type { MixerTab } from '../hooks/useMixerTabs';
import { dbToMeterScale } from '../meter-scale';

type MixerTabRowProps = {
  tab: MixerTab;
  // popup を開いているタブか
  isCurrent: boolean;
  // そのタブの最新のメーター値。まだ届いていなければ undefined
  meter: MeterValues | undefined;
  onOffsetChange: (offsetDb: number) => void;
};

// ミキサーの一覧の 1 行。5 列 (タイトル / 出力レベル / 自動補正 / オフセットのスライダー / オフセット値) で並ぶ。
// タイトルは 1 行に収まらなければ省略し、全文は title 属性で確認できるようにする。
export const MixerTabRow = ({ tab, isCurrent, meter, onOffsetChange }: MixerTabRowProps) => {
  const displayName = tab.title ?? `タブ ${String(tab.tabId)}`;
  const outputScale = dbToMeterScale(meter?.outRmsDb ?? DB_FLOOR);
  // LevelMeters と同じく、グラデーションはバー全幅に固定して clip-path で表示量を制御する。
  const clipPath = `inset(0 ${String((1 - outputScale) * 100)}% 0 0)`;

  const handleChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const next = Number.parseFloat(e.target.value);
    if (Number.isFinite(next)) onOffsetChange(next);
  };

  return (
    <li className="mixer-row">
      <span className="mixer-row__name">
        {isCurrent && <span className="mixer-row__current">このタブ</span>}
        <span className="mixer-row__title" title={displayName}>
          {displayName}
        </span>
      </span>
      <div className="meter-row__bar" aria-hidden="true">
        <div className="meter-row__fill" style={{ clipPath }} />
      </div>
      <span className="mixer-row__auto">自動 {formatSignedDb(meter?.mixerAutoDb ?? null)}</span>
      <input
        type="range"
        className="mixer-row__slider"
        min={MIXER_OFFSET_RANGE.min}
        max={MIXER_OFFSET_RANGE.max}
        step={MIXER_OFFSET_RANGE.step}
        value={tab.offsetDb}
        aria-label={`${displayName} の音量オフセット`}
        aria-valuetext={formatSignedDb(tab.offsetDb)}
        onChange={handleChange}
      />
      <span className="mixer-row__value">{formatSignedDb(tab.offsetDb)}</span>
    </li>
  );
};
