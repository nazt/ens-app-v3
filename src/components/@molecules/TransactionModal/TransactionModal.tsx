import { Button, Dialog, mq, Spinner, Typography } from '@ensdomains/thorin'
import { useAddRecentTransaction } from '@rainbow-me/rainbowkit'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled, { css } from 'styled-components'
import { useAccount, useSigner } from 'wagmi'
import { useRouter } from 'next/router'

import PaperPlaneColourSVG from '@app/assets/PaperPlaneColour.svg'
import { Outlink, StyledAnchor } from '@app/components/Outlink'
import { useChainName } from '@app/hooks/useChainName'
import { TransactionPreStepObject, TransactionSubmission } from '@app/types'
import { makeEtherscanLink } from '@app/utils/utils'
import { getRoute } from '@app/routes'

import { DisplayItems } from './DisplayItems'

const InnerDialog = styled.div(
  ({ theme }) => css`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    width: ${theme.space.full};
    padding: 0 ${theme.space['5']};
    gap: ${theme.space['4']};
    max-height: 60vh;
    overflow-y: auto;
    ${mq.sm.min(css`
      min-width: ${theme.space['128']};
    `)}
  `,
)

const ButtonShrinkwrap = styled(Button)(
  () => css`
    width: 80%;
    flex-shrink: 1;
    ${mq.md.min(css`
      width: 100%;
    `)}
  `,
)

const WaitingContainer = styled.div(
  ({ theme }) => css`
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    gap: ${theme.space['3']};
  `,
)

const WaitingTextContainer = styled.div(
  ({ theme }) => css`
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: center;
    text-align: left;
    color: ${theme.colors.textSecondary};
  `,
)

const StyledSpinner = styled(Spinner)(
  ({ theme }) => css`
    width: ${theme.space['9']};
    height: ${theme.space['9']};
  `,
)

const WaitingElement = () => {
  const { t } = useTranslation()

  return (
    <WaitingContainer data-testid="transaction-waiting-container">
      <StyledSpinner color="accent" />
      <WaitingTextContainer>
        <Typography weight="bold">
          {t('transaction.modal.confirm.waiting.title')}
        </Typography>
        <Typography>
          {t('transaction.modal.confirm.waiting.subtitle')}
        </Typography>
      </WaitingTextContainer>
    </WaitingContainer>
  )
}

const ErrorTypography = styled(Typography)(
  () => css`
    width: 100%;
    text-align: center;
  `,
)

const SuccessContent = styled.div(
  ({ theme }) => css`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: ${theme.space['2']};
    text-align: center;
  `,
)

const CompleteTypography = styled(Typography)(
  ({ theme }) => css`
    max-width: ${theme.space['80']};
  `,
)

type Stage = 'preSteps' | 'request' | 'confirm' | 'complete'

export const TransactionModal = ({
  displayItems,
  open,
  onDismiss,
  onSuccess,
  generateTx,
  actionName,
  completeTitle,
  dismissBtnLabel,
  completeBtnLabel,
  currentStep,
  stepCount,
  preSteps,
}: TransactionSubmission & {
  open: boolean
  currentStep: number
  stepCount: number
  preSteps?: TransactionPreStepObject
}) => {
  console.log('TransactionModal')
  const { t } = useTranslation()
  const chainName = useChainName()
  const router = useRouter()

  const [stage, setStage] = useState<Stage>('request')
  const addTransaction = useAddRecentTransaction()
  const { data: signer } = useSigner()
  const { data: accountData } = useAccount()
  const [error, setError] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<string | null>(null)
  const settingsRoute = getRoute('settings')

  const tryTransaction = useCallback(async () => {
    setError(null)
    try {
      const tx = await generateTx(signer!, accountData!.address!)
      if (!tx) throw new Error('No transaction generated')
      addTransaction({
        description: actionName,
        hash: tx.hash,
        confirmations: tx.confirmations || undefined,
      })
      setTxHash(tx.hash)
      setStage('complete')
    } catch (e: any) {
      if (e && e.code === 4001) {
        setError('transaction.modal.confirm.error.rejectedRequest')
      } else {
        setError(e ? e.message : 'transaction.modal.confirm.error.unknown')
      }
    }
  }, [generateTx, signer, accountData, addTransaction, actionName])

  const FilledDisplayItems = useMemo(
    () =>
      stage === 'preSteps' ? (
        <DisplayItems
          displayItems={
            preSteps?.steps.map((step, index) => ({
              fade: currentStep > index,
              shrink: true,
              label: t('transaction.modal.preSteps.step', { step: index + 1 }),
              value: t(`transaction.description.${step}`),
              useRawLabel: true,
            })) || []
          }
        />
      ) : (
        <DisplayItems
          displayItems={[
            {
              label: 'action',
              value: t(`transaction.description.${actionName}`),
            },
            {
              label: 'info',
              value: t(`transaction.info.${actionName}`),
            },
            ...(displayItems || []),
          ]}
        />
      ),
    [stage, preSteps, t, actionName, displayItems, currentStep],
  )
  const MiddleContent = useMemo(() => {
    if (stage === 'preSteps') {
      return preSteps?.content
    }
    if (stage === 'complete') {
      return (
        <SuccessContent>
          <PaperPlaneColourSVG />
          <CompleteTypography>
            {t('transaction.modal.complete.message')}
          </CompleteTypography>
          <StyledAnchor
            onClick={() => {
              onDismiss()
              router.push(settingsRoute.href)
            }}
          >
            View your transactions
          </StyledAnchor>
        </SuccessContent>
      )
    }
    if (stage === 'confirm') {
      return <WaitingElement />
    }
    return null
  }, [preSteps, stage, t])

  const LeadingButton = useMemo(() => {
    if (stage !== 'complete') {
      const customLabel =
        stage === 'preSteps' ? preSteps?.leadingLabel : dismissBtnLabel

      return (
        <ButtonShrinkwrap
          onClick={() => onDismiss?.()}
          variant="secondary"
          tone="grey"
          shadowless
          data-testid="transaction-modal-dismiss-btn"
        >
          {customLabel || t('transaction.modal.leadingButton')}
        </ButtonShrinkwrap>
      )
    }
    return null
  }, [stage, preSteps, dismissBtnLabel, t, onDismiss])

  const TrailingButton = useMemo(() => {
    if (stage === 'preSteps') {
      const tLabel =
        currentStep > 0
          ? t('transaction.modal.preSteps.trailingButtonResume')
          : t('transaction.modal.preSteps.trailingButton')
      return (
        <Button
          shadowless
          variant="primary"
          onClick={() => setStage('request')}
          data-testid="transaction-modal-preSteps-trailing-btn"
        >
          {preSteps?.trailingLabel || tLabel}
        </Button>
      )
    }
    if (stage === 'complete') {
      const final = currentStep + 1 === stepCount

      return (
        <Button
          variant={final ? 'secondary' : 'primary'}
          shadowless
          onClick={() => {
            onSuccess?.()
            if (final) onDismiss?.()
          }}
          data-testid="transaction-modal-complete-trailing-btn"
        >
          {completeBtnLabel ||
            (final
              ? t('transaction.modal.complete.trailingButton')
              : t('transaction.modal.complete.stepTrailingButton'))}
        </Button>
      )
    }
    if (stage === 'confirm') {
      return (
        <Button
          disabled={!error}
          shadowless
          variant="secondary"
          onClick={() => tryTransaction()}
          data-testid="transaction-modal-confirm-trailing-btn"
        >
          {t('transaction.modal.confirm.trailingButton')}
        </Button>
      )
    }
    return (
      <Button
        data-testid="transaction-modal-request-trailing-btn"
        shadowless
        onClick={() => setStage('confirm')}
      >
        {t('transaction.modal.request.trailingButton')}
      </Button>
    )
  }, [
    stage,
    t,
    preSteps,
    currentStep,
    stepCount,
    completeBtnLabel,
    onSuccess,
    onDismiss,
    error,
    tryTransaction,
  ])

  const title = useMemo(() => {
    if (stage === 'preSteps') {
      return preSteps?.title
    }
    if (stage === 'complete') {
      if (stepCount > 1) {
        return (
          completeTitle ||
          t('transaction.modal.complete.stepTitle', { step: currentStep + 1 })
        )
      }
      return completeTitle || t('transaction.modal.complete.title')
    }
    if (stage === 'confirm') {
      return t('transaction.modal.confirm.title')
    }
    return t('transaction.modal.request.title')
  }, [completeTitle, currentStep, preSteps, stage, stepCount, t])

  useEffect(() => {
    if (open) {
      if (preSteps) {
        setStage('preSteps')
      } else {
        setStage('request')
      }
      setError(null)
      setTxHash(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    setStage((prev) => (prev === 'preSteps' ? 'preSteps' : 'request'))
  }, [actionName])

  useEffect(() => {
    if (stage === 'confirm') {
      tryTransaction()
    }
  }, [stage, tryTransaction])

  const stepStatus = useMemo(() => {
    if (stage === 'preSteps') {
      return 'notStarted'
    }
    if (stage === 'complete') {
      return 'completed'
    }
    return 'inProgress'
  }, [stage])

  console.log('stage: ', stage)

  return (
    <Dialog
      title={title}
      subtitle={
        stage === 'request'
          ? t('transaction.modal.request.subtitle')
          : undefined
      }
      variant="actionable"
      leading={LeadingButton}
      trailing={TrailingButton}
      open={open}
      onDismiss={() => {
        console.log('onDismiss in TransactionModal')

        onDismiss?.()
        if (stage === 'complete') onSuccess?.()
      }}
      currentStep={currentStep}
      stepCount={stepCount > 1 ? stepCount : undefined}
      stepStatus={stepStatus}
    >
      <InnerDialog data-testid="transaction-modal-inner">
        {error ? (
          <ErrorTypography color="red">{t(error)}</ErrorTypography>
        ) : (
          MiddleContent
        )}
        {FilledDisplayItems}
        {stage === 'complete' && (
          <Outlink href={makeEtherscanLink(txHash!, chainName)}>
            {t('transaction.viewEtherscan')}
          </Outlink>
        )}
      </InnerDialog>
    </Dialog>
  )
}
