// @ts-nocheck

import { matchesOneOf, notMatchesOneOf } from '@utils/checkIf';
import { useDragAndDrop } from '@utils/hooks/useDragAndDrop';
import { useInfiniteLoading } from '@utils/hooks/useInfiniteLoading';
import { __ } from '@utils/i18n/i18n';
import { anyFunction, anyObj, PartialRecord } from '@utils/typings'
import ButtonElement from '@src/components/ButtonElement';
import Checkbox from '@src/components/Checkbox';
import CircularProgress from '@src/components/CircularProgress'
import Icon from '@src/components/Icon'
import { bindPullToRefresh } from '@src/components/PullToRefresh';
import { Skeleton } from '@src/components/SkeletonLoader';
import { BodyCell } from '@src/components/Table/BodyCell';
import { EditCell } from '@src/components/Table/EditCell';
import { HeaderCell } from '@src/components/Table/HeaderCell';
import Tooltip from '@src/components/Tooltip';
import { QueryStatus } from '@src/state/objectDataCollection'
import {
  FieldTypeIds,
  ObjectField,
} from '@src/state/objectFields/objectFieldsCollection'
import { showToast } from '@src/state/toastStore'
import { mq } from '@src/style/mediaQueries';
import { colors } from '@src/style/theme';
import { allowTextSelection } from '@src/style/helpers/allowTextSelection';
import { centerContent } from '@src/style/helpers/centerContent'
import { circle } from '@src/style/helpers/circle';import { fillContainer } from '@src/style/helpers/fillContainer';
import { inline } from '@src/style/helpers/inline'; import { transition } from '@src/style/helpers/transition';
import { ObjectItemValue } from '@src/api/schemas/responses/object.list';
import { isMobile as checkIfIsMobile } from '@src/utils/isMobile'
import { openModal } from '@src/utils/modals';
import { styled } from '@linaria/react';
import React, { memo, useCallback, useMemo, useRef, useState } from 'react';
import { useVirtual } from 'react-virtual';
import { useCreateStore } from 't-state/useCreateStore';
import { conformToMask } from 'react-text-mask';
import { masks } from '@src/components/TextField/textMasks';
import { useMeasureSize } from '@utils/hooks/useAutoresize'
import { clampMin } from '@utils/clamp';
import { reorderItemOnArray } from '@utils/reorderItemInArray';
import { toggleItemsInArray } from '@utils/toggleItemsInArray';
import { cx } from '@utils/cx';

console.log('test')
