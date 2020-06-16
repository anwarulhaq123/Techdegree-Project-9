"use strict";

const express = require("express");
const router = express.Router();
const { models } = require("./db");
const { check, validationResult } = require("express-validator");
const bcryptjs = require("bcryptjs");
const auth = require("basic-auth");

// Middleware function
function asyncHandler(cb) {
  return async (req, res, next) => {
    try {
      await cb(req, res, next);
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Middleware to authenticate the request using Basic Authentication.
 * @param {Request} req - The Express Request object.
 * @param {Response} res - The Express Response object.
 * @param {Function} next - The function to call to pass execution to the next middleware.
 */
const authenticateUser = async (req, res, next) => {
  let message = null;

  // Get the user's credentials from the Authorization header.
  const credentials = auth(req);
  // If the User exist get them by EmailAdress
  if (credentials) {
    const users = await models.User.findAll();
    const user = users.find((u) => u.emailAddress === credentials.name);

    if (user) {
      const authenticated = bcryptjs.compareSync(
        credentials.pass,
        user.password
      );
      // If the passwords match...
      if (authenticated) {
        console.log(
          `Authentication successful for emailAdress: ${user.emailAddress}`
        );
        // Store the user on the Request object.
        req.currentUser = user;
      } else {
        message = `Authentication failure: ${user.emailAddress}`;
      }
    } else {
      message = `User not found : ${credentials.name}`;
    }
  } else {
    message = "Auth header not found";
  }

  if (message) {
    console.warn(message);
    //  401 Unauthorized HTTP status code.
    res.status(401).json({ message: "Access Denied" });
  } else {
    next();
  }
};

/**************** User Routs***************/

// Send a GET request for the currently authenticated user.
router.get(
  "/users",
  authenticateUser,
  asyncHandler(async (req, res) => {
    const user = req.currentUser;
    res.json({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      emailAddress: user.emailAddress,
    });
  })
);

// Post request to create a new User.
router.post(
  "/users",
  [
    check("firstName")
      .exists({ checkNull: true, checkFalsy: true })
      .withMessage('Please provide  "firstName"'),
    check("lastName")
      .exists({ checkNull: true, checkFalsy: true })
      .withMessage('Please provide "lastName"'),
    check("emailAddress")
      .exists({ checkNull: true, checkFalsy: true })
      .withMessage('Please provide "emailAddress"')
      .isEmail()
      .withMessage('Please provide valid "email address" '),
    check("password")
      .exists({ checkNull: true, checkFalsy: true })
      .withMessage('Please provide "password"'),
  ],

  // Middleware
  asyncHandler(async (req, res) => {
    // Attempt to get the validation result from the Request object.
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      // Use the Array `map()` method to get a list of error messages.
      const errorMessages = errors.array().map((error) => error.msg);
      // Returns validation errors to the client.
      return res.status(400).json({ errors: errorMessages });
    }

    // Hash the new user's password.
    const password = bcryptjs.hashSync(req.body.password);

    const users = await models.User.create({
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      emailAddress: req.body.emailAddress,
      password,
    });

    // Set the status to 201 Created and end the response.
    res.location("/").status(201).end();
  })
);

/********************Course Routs******************** */

router.get(
  "/courses",
  //Middleware
  asyncHandler(async (req, res) => {
    const courses = await models.Course.findAll({
      attributes: { exclude: ["createdAt", "updatedAt"] },
      include: [
        {
          model: models.User,
          as: "owner",
          attributes: { exclude: ["createdAt", "updatedAt", "password"] },
        },
      ],
    });
    if (courses) {
      res.status(200).json(courses);
    } else {
      res.status(404).json({ message: "Does not exist" });
    }
  })
);

// Send a GET request that returns a course.
router.get(
  "/courses/:id",
  //Middleware
  asyncHandler(async (req, res) => {
    const course = await models.Course.findByPk(req.params.id, {
      attributes: { exclude: ["createdAt", "updatedAt"] },
      include: [
        {
          model: models.User,
          as: "owner",
          attributes: { exclude: ["createdAt", "updatedAt", "password"] },
        },
      ],
    });
    if (course) {
      res.status(200).json({ course });
    } else {
      res.status(404).json({ message: "Course not exist" });
    }
  })
);
// Send a POST request to create a new course.
router.post(
  "/courses",
  [
    check("title")
      .exists({ checkNull: true, checkFalsy: true })
      .withMessage('Please provide "title"'),
    check("description")
      .exists({ checkNull: true, checkFalsy: true })
      .withMessage('Please provide "description"'),
  ],
  authenticateUser,
  //Middleware
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      // Use the Array `map()` method to get a list of error messages.
      const errorMessages = errors.array().map((error) => error.msg);
      // Returns validation errors to the client.
      return res.status(400).json({ errors: errorMessages });
    }

    const course = await models.Course.create({
      title: req.body.title,
      description: req.body.description,
      estimatedTime: req.body.estimatedTime,
      materialsNeeded: req.body.materialsNeeded,
      userId: req.body.userId,
    });

    // Set the location header to the course URI and set status to 201 Created and end the response.
    res
      .location("/courses/" + course.id)
      .status(201)
      .end();
  })
);
//PUT /api/courses/:id 204 - Updates a course and returns no content

router.put(
  "/courses/:id",
  [
    check("title")
      .exists({ checkNull: true, checkFalsy: true })
      .withMessage('Please provide "title"'),
    check("description")
      .exists({ checkNull: true, checkFalsy: true })
      .withMessage('Pleas provide "description"'),
  ],
  authenticateUser,
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      // Use the Array `map()` method to get a list of error messages.
      const errorMessages = errors.array().map((error) => error.msg);
      // Returns validation errors to the client.
      return res.status(400).json({ errors: errorMessages });
    }
    const course = await models.Course.findByPk(req.params.id);
    const user = req.currentUser;

    if (course.userId === user.id) {
      await models.Course.update(
        {
          title: req.body.title,
          description: req.body.description,
          estimatedTime: req.body.estimatedTime,
          materialsNeeded: req.body.materialsNeeded,
        },
        { where: { id: req.params.id } }
      );
      res.status(204).end();
    } else {
      res.status(403).json("User has no course");
    }
  })
);

// DELETE /api/courses/:id 204 - Deletes a course and returns no content

router.delete(
  "/courses/:id",
  authenticateUser,
  // Middleware
  asyncHandler(async (req, res) => {
    const course = await models.Course.findByPk(req.params.id);
    const user = req.currentUser;

    if (course.userId === user.id) {
      await models.Course.destroy({
        where: { id: req.params.id },
      });
      res.status(204).end();
    } else {
      res.status(403).json("User has no course");
    }
  })
);

module.exports = router;
