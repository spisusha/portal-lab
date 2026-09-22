import { useLab } from '../state/labStore'
import {
  ACTION_LABELS,
  STATUS_LABELS,
  formatCountdown,
  currentCycle,
  formatClock,
  isActive,
} from '../domain/types'
import { riskHeadline } from '../domain/risk'
import { checkAction } from '../domain/rules'
import { recommendAction } from '../domain/recommend'
import { traitOf } from '../domain/live/worlds'
import { PortalGauge } from './PortalGauge'
import { WorldScene } from './WorldScene'
import { toLabAction } from './portalActions'

/**
 * Фоновые сцены девяти миров — собственные ассеты проекта из
 * `public/assets/portals`. Внешних картинок, шрифтов и CDN в проекте нет.
 *
 * Растровая сцена остаётся фоном внутри существующего кольца портала:
 * поверх неё по-прежнему лежат шкала опасности, виньетка и типографика.
 *
 * Путь собирается из `BASE_URL`, а не пишется руками: на GitHub Pages это
 * `/portal-lab/`, в тестах — `/`, и зашитая строка ломала бы одно из двух.
 */
const WORLD_FILES: Record<string, string> = {
  'Сумеречная топь': 'twilight-marsh',
  'Ледяные чертоги': 'ice-halls',
  'Пустошь Эхо': 'echo-wasteland',
  'Подземелья Керн': 'kern-underways',
  'Сад забытых имён': 'hollow-star',
  'Бездна Аркхан': 'arkhan-abyss',
  'Пепельные пустоши': 'ashen-wastes',
  'Залы Немой': 'silent-halls',
  'Море Сфер': 'sea-of-spheres',
}

function worldBackground(world: string): string | undefined {
  const file = WORLD_FILES[world]
  return file ? `${import.meta.env.BASE_URL}assets/portals/${file}.webp` : undefined
}

/**
 * Камера портала — главный объект экрана.
 *
 * Это слияние двух прежних блоков. Раньше «Требует решения сейчас» и
 * карточка портала пересказывали одно и то же двумя разными способами:
 * человек читал название, риск и рекомендацию дважды и не понимал, какой
 * из блоков главный. Теперь блок один, а его связь с очередью показана
 * строкой сверху: либо «портал выбран очередью, вот почему», либо
 * «вы смотрите не на самый опасный — вернуться к нему».
 */
export function PortalCamera({
  portalId,
  onSelect,
  onAct,
  firstStepPending,
  manualPick,
}: {
  portalId: string | null
  onSelect: (portalId: string) => void
  /** Закрепить портал в камере: после действия очередь пересортируется. */
  onAct: (portalId: string) => void
  firstStepPending: boolean
  /**
   * Портал показан потому, что его выбрал человек, а не потому, что камера
   * сама перешла к следующему. Разница видна только снаружи: внутри камеры
   * «показан не самый опасный» выглядит одинаково в обоих случаях.
   */
  manualPick: boolean
}) {
  const { portals, focus, forecast, dispatch, state } = useLab()
  const item = portals.find((p) => p.portal.id === portalId)

  if (!item) {
    return (
      <section className="camera camera--void" data-tour="camera">
        <div className="camera__void">
          <h2 className="camera__void-title">
            В лаборатории нет активных порталов
          </h2>
          <p>
            В лаборатории нет ни одного портала. Так выглядит смена, когда
            все врата закрыты, а новые ещё не открылись — выберите набор данных
            в шапке или загрузите штатную смену в очереди справа.
          </p>
        </div>
      </section>
    )
  }

  const { portal, risk } = item
  const trait = traitOf(portal.trait)
  const recommendation = recommendAction(portal)
  const action = recommendation.action
  const check = action ? checkAction(portal, action, currentCycle(state)) : null
  const outlook = forecast.outlooks.find((o) => o.portal.id === portal.id)

  const focused = focus?.item.portal.id === portal.id
  const urgency = focused ? focus.urgency : risk.rank === 'S' ? 'critical' : 'calm'
  const decisionTaken = isActive(portal) && portal.decisionCycle === currentCycle(state)

  return (
    <section
      className={`camera camera--${urgency} camera--rank-${risk.rank}${portal.id === 'p-19' ? ' camera--featured' : ''}`}
      aria-labelledby="camera-name"
      data-tour="camera"
    >
      {/* Откуда взялся именно этот портал. Связь очереди и камеры должна
          быть видимой, иначе выбор выглядит произвольным. */}
      {focused && focus ? (
        <p className="camera__pick">
          <span className="camera__pick-mark" aria-hidden="true" />
          <span>
            <strong>Очередь выбрала этот портал.</strong> {focus.reason}
          </span>
        </p>
      ) : (
        focus && (
          <p className="camera__pick camera__pick--manual">
            <span className="camera__pick-mark" aria-hidden="true" />
            <span>
              {/* После решения камера переходит к следующему порталу сама.
                  Писать в этот момент «вы открыли портал вручную» — врать
                  человеку про его же действие: он нажал кнопку решения,
                  а не выбирал портал в очереди. */}
              {manualPick
                ? 'Вы открыли портал вручную.'
                : 'Очередь перешла к следующему порталу.'}{' '}
              Самый опасный сейчас —{' '}
              <button
                type="button"
                className="link"
                onClick={() => onSelect(focus.item.portal.id)}
              >
                {focus.item.portal.name}
              </button>
              .
            </span>
          </p>
        )
      )}

      <div className="camera__glass">
        <div className="camera__scene" aria-hidden="true">
          <WorldScene
            world={portal.world}
            backgroundImage={worldBackground(portal.world)}
          />
        </div>
        <div className="camera__sweep" aria-hidden="true" />

        <PortalGauge risk={risk} />

        <div className="camera__plate">
          <p className="camera__world">{portal.world}</p>
          {/* Особенность мира стоит вплотную к его названию и до кнопок:
              игрок обязан знать её ДО решения, а не узнать из журнала. */}
          {trait && (
            <p className="camera__trait">
              <span className="camera__trait-name">{trait.title}</span>
              <span className="camera__trait-effect">{trait.effect}</span>
            </p>
          )}
          <h2 className="camera__name" id="camera-name">
            {portal.name}
          </h2>
          <p className="camera__rank">
            {risk.applicable
              ? `Ранг ${risk.rank} — ${risk.label} · ${STATUS_LABELS[portal.status]}`
              : STATUS_LABELS[portal.status]}
          </p>
          {decisionTaken && (
            <p className="camera__decision">
              Решение принято · {portal.decisionAtMinutes === null || portal.decisionAtMinutes === undefined ? '' : formatClock(portal.decisionAtMinutes)}
            </p>
          )}
        </div>
      </div>

      <dl className="vitals">
        <Vital
          label="Энергия"
          value={portal.energy}
          suffix="/ 100"
          fill={portal.energy}
          tone="energy"
        />
        <Vital
          label="Стабильность"
          value={portal.stability}
          suffix="/ 100"
          fill={portal.stability}
          tone="stability"
        />
        <Vital
          label="До схлопывания"
          value={formatCountdown(portal.minutesToCollapse)}
        />
        <Vital
          label="Существ внутри"
          value={`${portal.creaturesConfirmed ? '' : '≈'}${portal.creaturesInside}`}
          note={
            portal.creaturesConfirmed ? 'подтверждено' : 'оценка приборов'
          }
        />
      </dl>

      <div className="camera__verdict">
        <p className="camera__threat">{riskHeadline(risk)}</p>

        {isActive(portal) && outlook && (
          <p className={`camera__outlook camera__outlook--${outlook.collapsing ? 'critical' : 'drift'}`}>
            <span className="camera__outlook-label">Если не вмешаться</span>
            {outlook.collapsing
              ? `через цикл портал схлопнется${outlook.creaturesLost > 0 ? `, внутри останется существ: ${outlook.creaturesLost}` : ''}.`
              : `через цикл риск ${outlook.riskBefore} → ${outlook.riskAfter}, ранг ${outlook.rankBefore} → ${outlook.rankAfter}.`}
          </p>
        )}
      </div>

      <div className="camera__act">
        {action && check?.allowed ? (
          <>
            <button
              type="button"
              className={`btn btn--primary btn--lg${firstStepPending ? ' btn--beacon' : ''}`}
              data-tour="primary"
              disabled={state.shiftStatus === 'COMPLETE'}
              onClick={() => {
                onAct(portal.id)
                dispatch(toLabAction(action, portal.id))
              }}
            >
              {ACTION_LABELS[action]}
            </button>
            <p className="camera__why">{recommendation.text}</p>
            {firstStepPending && (
              <p className="camera__beacon">Начните отсюда</p>
            )}
          </>
        ) : (
          <p className="camera__why camera__why--alone">
            {action
              ? state.shiftStatus === 'COMPLETE'
                ? 'Смена завершена. Действия больше недоступны.'
                : `Рекомендованное действие «${ACTION_LABELS[action]}» сейчас недоступно: ${check?.reason}`
              : recommendation.text}
          </p>
        )}
      </div>
    </section>
  )
}

function Vital({
  label,
  value,
  suffix,
  note,
  fill,
  tone,
}: {
  label: string
  value: string | number
  suffix?: string
  note?: string
  fill?: number
  tone?: 'energy' | 'stability'
}) {
  return (
    <div className="vital">
      <dt className="vital__label">{label}</dt>
      <dd className="vital__body">
        <span className="vital__value">
          {value}
          {suffix && <span className="vital__suffix"> {suffix}</span>}
        </span>
        {note && <span className="vital__note">{note}</span>}
        {fill !== undefined && (
          <span className="vital__bar" aria-hidden="true">
            <span
              className={`vital__fill${tone ? ` vital__fill--${tone}` : ''}`}
              style={{ width: `${fill}%` }}
            />
          </span>
        )}
      </dd>
    </div>
  )
}
