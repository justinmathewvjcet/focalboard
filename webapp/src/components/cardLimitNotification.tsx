// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {useCallback, useEffect, useState} from 'react'
import {useIntl, FormattedMessage} from 'react-intl'

import AlertIcon from '../widgets/icons/alert'

import {useAppSelector, useAppDispatch} from '../store/hooks'
import {IUser, UserConfigPatch} from '../user'
import {getMe, patchProps, getCardLimitSnoozeUntil, getCardHiddenWarningSnoozeUntil} from '../store/users'
import {getCurrentBoardHiddenCardsCount, getCardHiddenWarning} from '../store/cards'
import TelemetryClient, {TelemetryActions, TelemetryCategory} from '../telemetry/telemetryClient'
import octoClient from '../octoClient'

import NotificationBox from '../widgets/notification-box'
import './cardLimitNotification.scss'

const snoozeTime = 1000 * 60 * 60 * 24 * 10
const checkSnoozeInterval = 1000 * 60 * 5

const CardLimitNotification = () => {
    const intl = useIntl()
    const [time, setTime] = useState(Date.now())

    const hiddenCards = useAppSelector<number>(getCurrentBoardHiddenCardsCount)
    const cardHiddenWarning = useAppSelector<boolean>(getCardHiddenWarning)
    const me = useAppSelector<IUser|null>(getMe)
    const snoozedUntil = useAppSelector<number>(getCardLimitSnoozeUntil)
    const snoozedCardHiddenWarningUntil = useAppSelector<number>(getCardHiddenWarningSnoozeUntil)
    const dispatch = useAppDispatch()

    const onCloseHidden = useCallback(async () => {
        if (me) {
            const patch: UserConfigPatch = {
                updatedFields: {
                    focalboard_cardLimitSnoozeUntil: `${Date.now() + snoozeTime}`,
                },
            }

            const patchedProps = await octoClient.patchUserConfig(me.id, patch)
            if (patchedProps) {
                dispatch(patchProps(patchedProps))
            }
        }
    }, [me])

    const onCloseWarning = useCallback(async () => {
        if (me) {
            const patch: UserConfigPatch = {
                updatedFields: {
                    focalboard_cardHiddenWarningSnoozeUntil: `${Date.now() + snoozeTime}`,
                },
            }

            const patchedProps = await octoClient.patchUserConfig(me.id, patch)
            if (patchedProps) {
                dispatch(patchProps(patchedProps))
            }
        }
    }, [me])

    let show = false
    let onClose = onCloseHidden
    let title = intl.formatMessage(
        {
            id: 'notification-box-card-limit-reached.title',
            defaultMessage: '{cards} cards hidden from board',
        },
        {cards: hiddenCards},
    )

    if (hiddenCards > 0 && time > snoozedUntil) {
        show = true
    }

    if (!show && cardHiddenWarning) {
        show = time > snoozedCardHiddenWarningUntil
        onClose = onCloseWarning
        title = intl.formatMessage(
            {
                id: 'notification-box-cards-hidden.title',
                defaultMessage: 'This action has hidden another card',
            },
        )
    }

    useEffect(() => {
        if (!show) {
            const interval = setInterval(() => setTime(Date.now()), checkSnoozeInterval)
            return () => {
                clearInterval(interval)
            }
        }
        return () => null
    }, [show])

    useEffect(() => {
        if (show) {
            TelemetryClient.trackEvent(TelemetryCategory, TelemetryActions.LimitCardLimitReached, {})
        }
    }, [show])

    const onClick = useCallback(() => {
        (window as any).openPricingModal()()
        TelemetryClient.trackEvent(TelemetryCategory, TelemetryActions.LimitCardLimitLinkOpen, {})
    }, [])

    const hasPermissionToUpgrade = me?.roles?.split(' ').indexOf('system_admin') !== -1

    if (!show) {
        return null
    }

    return (
        <NotificationBox
            icon={<AlertIcon/>}
            title={title}
            onClose={onClose}
            closeTooltip={intl.formatMessage({
                id: 'notification-box-card-limit-reached.close-tooltip',
                defaultMessage: 'Snooze for 10 days',
            })}
        >
            {hasPermissionToUpgrade &&
                <FormattedMessage
                    id='notification-box.card-limit-reached.text'
                    defaultMessage='Card limit reached, to view older cards, {link}'
                    values={{
                        link: (
                            <a
                                onClick={onClick}
                            >
                                <FormattedMessage
                                    id='notification-box-card-limit-reached.link'
                                    defaultMessage='Upgrade to a paid plan'
                                />
                            </a>),
                    }}
                />}
            {!hasPermissionToUpgrade &&
                <FormattedMessage
                    id='notification-box.card-limit-reached.not-admin.text'
                    defaultMessage='To access archived cards, contact your Admin to upgrade to a paid plan.'
                />}
        </NotificationBox>
    )
}

export default React.memo(CardLimitNotification)