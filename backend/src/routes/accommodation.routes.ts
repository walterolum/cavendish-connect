import { Router } from 'express';
import { body } from 'express-validator';
import { accommodationController } from '../controllers/accommodation.controller';
import { authenticate, optionalAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { uploadMultiple } from '../middleware/upload';

const router = Router();

const PROPERTY_TYPES = ['HOSTEL', 'SINGLE_ROOM', 'SHARED_ROOM', 'APARTMENT', 'HOUSE', 'BEDSITTER', 'OTHER'];

router.get('/', optionalAuth, accommodationController.getProperties);

router.get('/my-properties', authenticate, accommodationController.getMyProperties);

router.get('/:slug', optionalAuth, accommodationController.getProperty);

router.post('/', authenticate, [
  body('title').trim().notEmpty().isLength({ max: 200 }).withMessage('Title is required (max 200 chars)'),
  body('description').trim().notEmpty().isLength({ max: 5000 }).withMessage('Description is required'),
  body('categoryId').isInt({ min: 1 }).withMessage('Property category is required'),
  body('propertyType').isIn(PROPERTY_TYPES).withMessage('Valid property type is required'),
  body('location').trim().notEmpty().withMessage('Location is required'),
  body('latitude').optional().isFloat({ min: -90, max: 90 }),
  body('longitude').optional().isFloat({ min: -180, max: 180 }),
  body('monthlyPrice').isFloat({ min: 0 }).withMessage('Monthly price must be a positive number'),
  body('depositAmount').optional().isFloat({ min: 0 }),
  body('currency').optional().isIn(['UGX', 'USD', 'KES', 'TZS']),
  body('distanceFromCampus').optional().trim(),
  body('totalRooms').optional().isInt({ min: 1 }),
  body('availableRooms').optional().isInt({ min: 0 }),
  body('roomType').optional().trim().isLength({ max: 100 }),
  body('isFurnished').optional().isBoolean(),
  body('hasWifi').optional().isBoolean(),
  body('hasWater').optional().isBoolean(),
  body('hasElectricity').optional().isBoolean(),
  body('hasSecurity').optional().isBoolean(),
  body('hasParking').optional().isBoolean(),
  body('rules').optional().trim().isLength({ max: 2000 }),
  validate,
], accommodationController.createProperty);

router.put('/:id', authenticate, [
  body('title').optional().trim().isLength({ max: 200 }),
  body('description').optional().trim().isLength({ max: 5000 }),
  body('categoryId').optional().isInt({ min: 1 }),
  body('propertyType').optional().isIn(PROPERTY_TYPES),
  body('location').optional().trim().notEmpty(),
  body('latitude').optional().isFloat({ min: -90, max: 90 }),
  body('longitude').optional().isFloat({ min: -180, max: 180 }),
  body('monthlyPrice').optional().isFloat({ min: 0 }),
  body('depositAmount').optional().isFloat({ min: 0 }),
  body('currency').optional().isIn(['UGX', 'USD', 'KES', 'TZS']),
  body('distanceFromCampus').optional().trim(),
  body('totalRooms').optional().isInt({ min: 1 }),
  body('availableRooms').optional().isInt({ min: 0 }),
  body('roomType').optional().trim().isLength({ max: 100 }),
  body('isFurnished').optional().isBoolean(),
  body('hasWifi').optional().isBoolean(),
  body('hasWater').optional().isBoolean(),
  body('hasElectricity').optional().isBoolean(),
  body('hasSecurity').optional().isBoolean(),
  body('hasParking').optional().isBoolean(),
  body('rules').optional().trim().isLength({ max: 2000 }),
  validate,
], accommodationController.updateProperty);

router.delete('/:id', authenticate, accommodationController.deleteProperty);

router.post('/:id/images', authenticate, uploadMultiple, accommodationController.addImages);

router.post('/:id/amenities', authenticate, [
  body('amenityIds').isArray({ min: 1 }).withMessage('amenityIds array is required'),
  body('amenityIds.*').isInt({ min: 1 }),
  validate,
], accommodationController.addAmenities);

export default router;