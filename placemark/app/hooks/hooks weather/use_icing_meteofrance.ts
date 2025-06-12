import { useEffect, useState, useCallback } from 'react';
import { useAtom } from 'jotai';
import { dataAtom } from 'state/jotai';
import { usePersistence } from 'app/lib/persistence/context';
import { newFeatureId } from 'app/lib/id';
import { IFolder, IWrappedFeature } from 'types';
import { generateNKeysBetween } from 'fractional-indexing';